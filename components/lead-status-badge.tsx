import { Badge } from '@/components/ui/badge';
import { LeadStatus } from '@/lib/constants';

const statusVariantMap: Record<LeadStatus, 'secondary' | 'default' | 'warning' | 'success' | 'danger'> = {
  new: 'secondary',
  contacted: 'default',
  replied: 'warning',
  qualified: 'success',
  disqualified: 'danger'
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge variant={statusVariantMap[status]}>{status}</Badge>;
}
