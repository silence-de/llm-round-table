import type { DecisionTemplate } from '../decision/types';

export type VerificationProfileId =
  | 'career_offer'
  | 'career_company_research'
  | 'life_housing'
  | 'life_location_policy'
  | 'money_investment_product'
  | 'money_large_purchase';

export interface VerificationProfileDefinition {
  id: VerificationProfileId;
  label: string;
  family: DecisionTemplate['family'];
  description: string;
  extractionTargets: string[];
}

export const VERIFICATION_PROFILES: VerificationProfileDefinition[] = [
  {
    id: 'career_offer',
    label: 'Offer details',
    family: 'career',
    description: 'Extract compensation, work mode, visa/relocation, benefits, and deadlines.',
    extractionTargets: [
      'salary',
      'compensation',
      'equity',
      'bonus',
      'location',
      'hybrid',
      'remote',
      'visa',
      'relocation',
      'benefits',
      'deadline',
      'start date',
    ],
  },
  {
    id: 'career_company_research',
    label: 'Company research',
    family: 'career',
    description: 'Extract company, hiring, team, policy, and latest-date signals.',
    extractionTargets: [
      'about',
      'mission',
      'team',
      'manager',
      'hiring',
      'benefits',
      'policy',
      'latest',
      'updated',
    ],
  },
  {
    id: 'life_housing',
    label: 'Housing listing',
    family: 'life',
    description: 'Extract price, area, location, commute, and housing constraints.',
    extractionTargets: [
      'rent',
      'price',
      'deposit',
      'sqft',
      'sqm',
      'bedroom',
      'bathroom',
      'commute',
      'school',
      'pets',
      'parking',
    ],
  },
  {
    id: 'life_location_policy',
    label: 'Location policy',
    family: 'life',
    description: 'Extract official policy date, eligibility, restrictions, and linked authorities.',
    extractionTargets: [
      'policy',
      'effective',
      'eligibility',
      'restriction',
      'resident',
      'permit',
      'official',
      'government',
    ],
  },
  {
    id: 'money_investment_product',
    label: 'Investment product',
    family: 'money',
    description: 'Extract fees, liquidity, lock-up, risk language, and benchmark markers.',
    extractionTargets: [
      'fee',
      'expense ratio',
      'liquidity',
      'lock-up',
      'risk',
      'benchmark',
      'return',
      'performance',
      'prospectus',
    ],
  },
  {
    id: 'money_large_purchase',
    label: 'Large purchase',
    family: 'money',
    description: 'Extract price, warranty, return policy, financing, and shipping constraints.',
    extractionTargets: [
      'price',
      'discount',
      'warranty',
      'return',
      'financing',
      'apr',
      'shipping',
      'delivery',
      'install',
    ],
  },
];

export function getVerificationProfile(
  profileId?: string | null
): VerificationProfileDefinition | null {
  if (!profileId) return null;
  return VERIFICATION_PROFILES.find((profile) => profile.id === profileId) ?? null;
}
