'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { useTRPC } from '../../lib/trpc-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type UserRole = 'admin' | 'user';

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrátor',
  user: 'Používateľ',
};

// Literal Tailwind classes for role badges (using design tokens like posts-table.tsx)
const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  admin: 'border-carnaby/30 bg-carnaby/15 text-carnaby',
  user: 'border-white/20 bg-white/10 text-white/60',
};

const DATE_FORMATTER = new Intl.DateTimeFormat('sk', { dateStyle: 'medium' });

/**
 * `/admin/users` table (Task 22): read-only list of all users with avatar, name, email, role badge,
 * and created date. Owns all of its own tRPC/react-query calls; `app/admin/users/page.tsx` is just
 * a thin wrapper.
 */
export function UsersTable() {
  const trpc = useTRPC();

  const listQuery = useQuery(trpc.users.list.queryOptions());

  const items = listQuery.data ?? [];

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };


  return (
    <div className="flex flex-col gap-4">
      <div className="glass overflow-hidden rounded-glass">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Avatar</TableHead>
              <TableHead>Meno</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rola</TableHead>
              <TableHead>Registrovaný</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-white/50">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Načítavam používateľov…
                  </div>
                </TableCell>
              </TableRow>
            ) : listQuery.isError ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-3 text-white/60">
                    <span>Nepodarilo sa načítať používateľov.</span>
                    <Button variant="outline" size="sm" onClick={() => listQuery.refetch()}>
                      Skúsiť znova
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-white/50">
                  Žiadni používatelia nenájdení.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const role = (item.role ?? 'user') as UserRole;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name || 'Používateľ'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-white/10 text-xs font-semibold text-white/70">
                            {getInitials(item.name)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-white">{item.name || '—'}</TableCell>
                    <TableCell className="text-white/70">{item.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_BADGE_CLASS[role]}>
                        {ROLE_LABEL[role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white/70">{DATE_FORMATTER.format(new Date(item.createdAt))}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="border-t border-line px-4 py-3 text-sm text-white/60">
          <span>Celkovo {items.length} používateľov</span>
        </div>
      </div>
    </div>
  );
}
