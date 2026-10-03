import type { User } from '@webmotiv/shared';
import { Badge } from '../../components/badge.tsx';

export function UserStatus({ user }: { user: Pick<User, 'isActive' | 'mustChangePassword'> }) {
  // Статус учётной записи, а не человека: «заблокирована», «активна».
  if (!user.isActive) return <Badge tone="danger">Заблокирована</Badge>;
  if (user.mustChangePassword) return <Badge>Временный пароль</Badge>;
  return <Badge tone="success">Активна</Badge>;
}
