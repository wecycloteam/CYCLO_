import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { MockWasteClassifier } from './mock-waste-classifier.provider';

describe('MockWasteClassifier (§11-§13)', () => {
  let classifier: MockWasteClassifier;
  const materials = [
    { category: 'plastic', subtype: 'PET', label: 'PET Plastic', recyclable: true, active: true },
    { category: 'other', subtype: 'MIXED', label: 'Mixed/Unsorted', recyclable: false, active: true },
  ];

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MockWasteClassifier,
        {
          provide: PrismaService,
          useValue: { wasteMaterial: { findMany: jest.fn().mockResolvedValue(materials) } },
        },
      ],
    }).compile();
    classifier = moduleRef.get(MockWasteClassifier);
  });

  it('always marks the result as mock', async () => {
    const result = await classifier.classify('data:image/jpeg;base64,irrelevant');
    expect(result.mock).toBe(true);
  });

  it('returns a confidence in a plausible 0-1 range', async () => {
    const result = await classifier.classify('data:image/jpeg;base64,irrelevant');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('picks a material that actually exists in the taxonomy', async () => {
    const result = await classifier.classify('data:image/jpeg;base64,irrelevant');
    const match = materials.find((m) => m.category === result.category && m.subtype === result.subtype);
    expect(match).toBeDefined();
    expect(result.recyclable).toBe(match?.recyclable);
  });

  it('gives non-recyclable-appropriate handling instructions for a non-recyclable pick', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MockWasteClassifier,
        {
          provide: PrismaService,
          useValue: {
            wasteMaterial: { findMany: jest.fn().mockResolvedValue([materials[1]]) },
          },
        },
      ],
    }).compile();
    const onlyNonRecyclable = moduleRef.get(MockWasteClassifier);

    const result = await onlyNonRecyclable.classify('data:image/jpeg;base64,irrelevant');
    expect(result.recyclable).toBe(false);
    expect(result.handlingInstructions.join(' ')).not.toMatch(/list it for sale/i);
  });

  it('throws a clear error when no materials are seeded', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MockWasteClassifier,
        { provide: PrismaService, useValue: { wasteMaterial: { findMany: jest.fn().mockResolvedValue([]) } } },
      ],
    }).compile();
    const empty = moduleRef.get(MockWasteClassifier);

    await expect(empty.classify('data:image/jpeg;base64,irrelevant')).rejects.toThrow(/seed/i);
  });
});
