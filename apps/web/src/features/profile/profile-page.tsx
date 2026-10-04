import { type ReactNode, useState } from 'react';
import { useMySessions, useTerminateOtherSessions, useTerminateSession } from '../../api/auth.ts';
import { useCurrentUser } from '../../app/session.tsx';
import { Badge } from '../../components/badge.tsx';
import { Button } from '../../components/button.tsx';
import { ConfirmDialog } from '../../components/dialog.tsx';
import { Page } from '../../components/page.tsx';
import { Section } from '../../components/section.tsx';
import { LoadError, Loading } from '../../components/status.tsx';
import { PasswordSection } from './password-section.tsx';
import { SessionList } from './session-list.tsx';

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-x-6">
      <dt className="w-24 shrink-0 text-[13px] text-subtle">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm text-fg">{children}</dd>
    </div>
  );
}

function SessionsSection() {
  const sessions = useMySessions();
  const terminate = useTerminateSession();
  const terminateOthers = useTerminateOtherSessions();
  const [confirmOthers, setConfirmOthers] = useState(false);
  const others = sessions.data?.filter((session) => !session.current).length ?? 0;

  return (
    <Section
      title="Сеансы"
      description="Где выполнен вход в вашу учётную запись"
      aside={
        others > 0 && (
          <Button variant="danger-ghost" onClick={() => setConfirmOthers(true)}>
            Завершить остальные
          </Button>
        )
      }
    >
      {sessions.isPending && <Loading />}
      {sessions.isError && (
        <LoadError error={sessions.error} onRetry={() => void sessions.refetch()} />
      )}
      {sessions.data && (
        <SessionList
          sessions={sessions.data}
          empty="Нет активных сеансов."
          action={(session) =>
            !session.current && (
              <Button
                variant="danger-ghost"
                disabled={terminate.isPending}
                onClick={() => terminate.mutate(session.id)}
              >
                Завершить
              </Button>
            )
          }
        />
      )}
      <ConfirmDialog
        open={confirmOthers}
        onClose={() => setConfirmOthers(false)}
        onConfirm={() =>
          terminateOthers.mutate(undefined, { onSuccess: () => setConfirmOthers(false) })
        }
        title="Завершить остальные сеансы?"
        description="На других устройствах и в других браузерах нужно будет войти заново. Этот сеанс останется."
        confirmLabel="Завершить"
        pending={terminateOthers.isPending}
        error={terminateOthers.error?.message}
      />
    </Section>
  );
}

export function ProfilePage() {
  const me = useCurrentUser();
  return (
    <Page title="Профиль" width="narrow">
      <Section title="Учётная запись" description="ФИО, логин и роли меняет администратор">
        <dl className="flex flex-col gap-3">
          <InfoRow label="ФИО">{me.fullName}</InfoRow>
          <InfoRow label="Логин">{me.login}</InfoRow>
          <InfoRow label="Роли">
            <span className="flex flex-wrap gap-1.5">
              {me.roles.length > 0
                ? me.roles.map((role) => <Badge key={role.id}>{role.name}</Badge>)
                : 'Без роли'}
            </span>
          </InfoRow>
        </dl>
      </Section>
      <PasswordSection login={me.login} />
      <SessionsSection />
    </Page>
  );
}
