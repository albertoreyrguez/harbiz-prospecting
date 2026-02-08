export const LEAD_STATUSES = ['new', 'contacted', 'replied', 'qualified', 'disqualified'] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
