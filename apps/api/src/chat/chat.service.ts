import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartConversationDto } from './dto/start-conversation.dto';

const CONVERSATION_SELECT = {
  id: true,
  listingId: true,
  buyerId: true,
  sellerId: true,
  createdAt: true,
  updatedAt: true,
  buyer: { select: { id: true, name: true, avatarUrl: true } },
  seller: { select: { id: true, name: true, avatarUrl: true } },
  listing: { select: { id: true, askingPrice: true, photos: true, material: { select: { label: true } } } },
} as const;

// WasteListing.photos is a JSON-encoded string at the DB level (see
// marketplace.service.ts's mapListing) — every read path decodes it the same way so the
// API's shape matches what the client expects, never a raw JSON string.
function mapConversation<T extends { listing: { photos?: string | null } | null }>(conversation: T) {
  if (!conversation.listing) return conversation as T & { listing: null };
  return {
    ...conversation,
    listing: { ...conversation.listing, photos: conversation.listing.photos ? JSON.parse(conversation.listing.photos) : [] },
  };
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // The buyer is always the current user — a seller never "starts" a conversation about
  // their own listing with themselves, they just reply once the buyer opens one.
  async startConversation(buyerId: string, dto: StartConversationDto) {
    let sellerId = dto.sellerId;
    if (dto.listingId) {
      const listing = await this.prisma.wasteListing.findUnique({ where: { id: dto.listingId } });
      if (!listing) throw new NotFoundException('Listing not found.');
      sellerId = listing.sellerId;
    }
    if (!sellerId) throw new BadRequestException('sellerId or listingId is required.');
    if (sellerId === buyerId) throw new BadRequestException('You cannot message yourself.');

    // findFirst rather than the generated compound-unique lookup — Postgres treats every
    // NULL listingId as distinct for uniqueness purposes, so a typed findUnique on
    // (listingId, buyerId, sellerId) would never match existing listing-less
    // conversations. An application-level check is enough here; a rare duplicate thread
    // from a race is harmless for chat (both are usable), unlike a payment record.
    const existing = await this.prisma.conversation.findFirst({
      where: { listingId: dto.listingId ?? null, buyerId, sellerId },
      select: CONVERSATION_SELECT,
    });
    if (existing) return mapConversation(existing);

    const conversation = await this.prisma.conversation.create({
      data: { listingId: dto.listingId, buyerId, sellerId },
      select: CONVERSATION_SELECT,
    });
    return mapConversation(conversation);
  }

  async listMine(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      orderBy: { updatedAt: 'desc' },
      select: {
        ...CONVERSATION_SELECT,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    // Real unread counts, one query per conversation kept simple/obvious rather than a
    // single clever groupBy — conversation lists are small (a person messages a handful
    // of sellers/buyers, not thousands), so this isn't a real performance concern.
    return Promise.all(
      conversations.map(async (c) => {
        const unreadCount = await this.prisma.message.count({
          where: { conversationId: c.id, senderId: { not: userId }, readAt: null },
        });
        const { messages, ...rest } = c;
        return { ...mapConversation(rest), lastMessage: messages[0] ?? null, unreadCount };
      }),
    );
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
      throw new ForbiddenException('You are not part of this conversation.');
    }
    return conversation;
  }

  async getMessages(userId: string, conversationId: string) {
    await this.assertParticipant(conversationId, userId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    // "Delete for me" hides a message from just that one viewer — filtered here rather
    // than in the query above so the same row still exists (and is still visible to the
    // other participant) exactly like WhatsApp's per-device delete.
    return messages
      .filter((m) => !m.deletedForUserIds.includes(userId))
      .map(({ deletedForUserIds: _deletedForUserIds, ...m }) =>
        m.deletedForEveryone ? { ...m, body: 'This message was deleted' } : m,
      );
  }

  async sendMessage(userId: string, conversationId: string, body: string) {
    await this.assertParticipant(conversationId, userId);
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({ data: { conversationId, senderId: userId, body } }),
      this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    ]);
    return message;
  }

  private async getOwnMessage(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found.');
    await this.assertParticipant(message.conversationId, userId);
    return message;
  }

  // Hides this one message from just the caller — the other participant's copy is
  // untouched. Works on any message in the conversation (yours or theirs), same as
  // WhatsApp's "Delete for me".
  async deleteForMe(userId: string, messageId: string) {
    const message = await this.getOwnMessage(userId, messageId);
    if (!message.deletedForUserIds.includes(userId)) {
      await this.prisma.message.update({
        where: { id: messageId },
        data: { deletedForUserIds: { push: userId } },
      });
    }
    return { message: 'Deleted for you.' };
  }

  // Replaces the body for both participants — only the original sender may do this,
  // same restriction WhatsApp applies to "Delete for everyone".
  async deleteForEveryone(userId: string, messageId: string) {
    const message = await this.getOwnMessage(userId, messageId);
    if (message.senderId !== userId) {
      throw new ForbiddenException('Only the sender can delete this message for everyone.');
    }
    await this.prisma.message.update({ where: { id: messageId }, data: { deletedForEveryone: true } });
    return { message: 'Deleted for everyone.' };
  }

  async markRead(userId: string, conversationId: string) {
    await this.assertParticipant(conversationId, userId);
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
    return { message: 'Marked as read.' };
  }
}
