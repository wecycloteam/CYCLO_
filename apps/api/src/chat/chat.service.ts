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
  async startConversation(callerId: string, dto: StartConversationDto) {
    let buyerId = callerId;
    let sellerId = dto.sellerId;
    if (dto.listingId) {
      const listing = await this.prisma.wasteListing.findUnique({ where: { id: dto.listingId } });
      if (!listing) throw new NotFoundException('Listing not found.');
      sellerId = listing.sellerId;
      if (listing.sellerId === callerId && dto.buyerId) {
        const order = await this.prisma.order.findFirst({ where: { listingId: dto.listingId, buyerId: dto.buyerId } });
        if (!order) throw new BadRequestException('That user has no order on this listing.');
        buyerId = dto.buyerId;
      }
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
        buyerArchivedAt: true,
        sellerArchivedAt: true,
        buyerDeletedAt: true,
        sellerDeletedAt: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    // Real unread counts, one query per conversation kept simple/obvious rather than a
    // single clever groupBy — conversation lists are small (a person messages a handful
    // of sellers/buyers, not thousands), so this isn't a real performance concern.
    return Promise.all(
      conversations
        .filter((c) => (userId === c.buyerId ? !c.buyerDeletedAt : !c.sellerDeletedAt))
        .map(async (c) => {
          const unreadCount = await this.prisma.message.count({
            where: { conversationId: c.id, senderId: { not: userId }, readAt: null },
          });
          const isBuyer = userId === c.buyerId;
          const archived = Boolean(isBuyer ? c.buyerArchivedAt : c.sellerArchivedAt);
          const { messages, buyerArchivedAt: _b, sellerArchivedAt: _s, buyerDeletedAt: _bd, sellerDeletedAt: _sd, ...rest } = c;
          return { ...mapConversation(rest), lastMessage: messages[0] ?? null, unreadCount, archived };
        }),
    );
  }

  async setArchived(userId: string, conversationId: string, archived: boolean) {
    const conversation = await this.assertParticipant(conversationId, userId);
    const isBuyer = conversation.buyerId === userId;
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: isBuyer ? { buyerArchivedAt: archived ? new Date() : null } : { sellerArchivedAt: archived ? new Date() : null },
    });
    return { message: archived ? 'Archived.' : 'Unarchived.' };
  }

  // Soft-delete, per viewer only — see the schema comment on Conversation.buyerDeletedAt.
  async deleteConversation(userId: string, conversationId: string) {
    const conversation = await this.assertParticipant(conversationId, userId);
    const isBuyer = conversation.buyerId === userId;
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: isBuyer ? { buyerDeletedAt: new Date() } : { sellerDeletedAt: new Date() },
    });
    return { message: 'Conversation deleted.' };
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
    const conversation = await this.assertParticipant(conversationId, userId);

    // Recording that this participant's client just synced is exactly what a real
    // WhatsApp-style "delivered" tick means — the recipient's device has actually fetched
    // since the message was sent, not merely that the server accepted it. Updated on every
    // fetch (not just markRead) so ticks progress even before the thread is marked read.
    const isBuyer = conversation.buyerId === userId;
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: isBuyer ? { buyerLastSeenAt: new Date() } : { sellerLastSeenAt: new Date() },
    });
    // The OTHER participant's last-seen time is what determines delivery status for
    // messages *this* user sent.
    const otherLastSeenAt = isBuyer ? conversation.sellerLastSeenAt : conversation.buyerLastSeenAt;

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
      .map(({ deletedForUserIds: _deletedForUserIds, ...m }) => {
        const withBody = m.deletedForEveryone ? { ...m, body: 'This message was deleted' } : m;
        if (m.senderId !== userId) return { ...withBody, status: null };
        const status: 'sent' | 'delivered' | 'read' = m.readAt
          ? 'read'
          : otherLastSeenAt && otherLastSeenAt >= m.createdAt
            ? 'delivered'
            : 'sent';
        return { ...withBody, status };
      });
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    body: string | undefined,
    attachmentUrl?: string,
    attachmentType?: string,
  ) {
    const conversation = await this.assertParticipant(conversationId, userId);
    if (!body?.trim() && !attachmentUrl) {
      throw new BadRequestException('Enter a message or attach a photo/voice note.');
    }
    // A new message un-deletes the conversation for whoever RECEIVES it (not the sender) —
    // the same behavior a real chat app has: a conversation you'd removed from your list
    // reappears the moment the other person messages you again. The sender's own delete
    // state, if any, is left alone.
    const recipientIsBuyer = conversation.sellerId === userId;
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId: userId, body: body?.trim() ?? '', attachmentUrl, attachmentType },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
          ...(recipientIsBuyer ? { buyerDeletedAt: null } : { sellerDeletedAt: null }),
        },
      }),
    ]);
    return { ...message, status: 'sent' as const };
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
