import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarkupRule, MarkupType } from '../entities/markup-rule.entity';

@Injectable()
export class MarkupService {
  constructor(
    @InjectRepository(MarkupRule)
    private readonly markupRuleRepo: Repository<MarkupRule>,
  ) {}

  /**
   * Calculates flight markup based on the single active MarkupRule in the database.
   * If no rule is active, markup is 0.
   * Percentage calculations are rounded half-up to the nearest minor unit.
   */
  async calculateMarkup(
    baseAmount: number,
  ): Promise<{ ruleId: string | null; amount: number }> {
    const activeRule = await this.markupRuleRepo.findOneBy({ isActive: true });
    if (!activeRule) {
      return { ruleId: null, amount: 0 };
    }

    const value = parseFloat(activeRule.value);
    if (isNaN(value)) {
      return { ruleId: activeRule.id, amount: 0 };
    }

    if (activeRule.type === MarkupType.Percentage) {
      // Round half-up to the nearest minor unit integer
      const calculated = baseAmount * (value / 100);
      return { ruleId: activeRule.id, amount: Math.round(calculated) };
    } else {
      // Fixed value is already in minor units
      return { ruleId: activeRule.id, amount: Math.round(value) };
    }
  }
}
