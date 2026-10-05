import type { DirectoryUser, Order } from '@webmotiv/shared';
import { Ban, Pencil, UserRoundCog } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { isApiError } from '../../api/client.ts';
import { useCancelOrder, useUpdateOrder } from '../../api/orders.ts';
import { Button } from '../../components/button.tsx';
import { Dialog } from '../../components/dialog.tsx';
import { TextInput } from '../../components/input.tsx';
import { Section } from '../../components/section.tsx';
import { Select } from '../../components/select.tsx';
import { TextArea } from '../../components/textarea.tsx';
import { Field, Notice } from '../../components/ui.tsx';
import { formatDateTime } from '../../lib/format.ts';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="text-sm break-words text-fg">{children}</dd>
    </div>
  );
}

type DialogKind = 'header' | 'responsible' | 'cancel' | null;

/** Шапка заказа и действия с ним: правка, смена ответственного, отмена. */
export function OrderInfo({ order, users }: { order: Order; users: DirectoryUser[] }) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  return (
    <Section
      title="Заказ"
      aside={
        order.canEditHeader && (
          <Button variant="ghost" icon={Pencil} onClick={() => setDialog('header')}>
            Изменить
          </Button>
        )
      }
    >
      <dl className="flex flex-col gap-3">
        <Row label="Покупатель">{order.customer}</Row>
        {order.comment && (
          <Row label="Комментарий">
            <span className="whitespace-pre-wrap">{order.comment}</span>
          </Row>
        )}
        <Row label="Ответственный">{order.responsible.fullName}</Row>
        <Row label="Шаблон">{order.template.name}</Row>
        <Row label="Создан">
          {formatDateTime(order.createdAt)} · {order.createdBy.fullName}
        </Row>
        {order.completedAt && (
          <Row label={order.status === 'cancelled' ? 'Отменён' : 'Завершён'}>
            {formatDateTime(order.completedAt)}
          </Row>
        )}
      </dl>
      {order.canManage && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button icon={UserRoundCog} onClick={() => setDialog('responsible')}>
            Сменить ответственного
          </Button>
          <Button variant="danger-ghost" icon={Ban} onClick={() => setDialog('cancel')}>
            Отменить заказ
          </Button>
        </div>
      )}
      {dialog === 'header' && <HeaderDialog order={order} onClose={() => setDialog(null)} />}
      {dialog === 'responsible' && (
        <ResponsibleDialog order={order} users={users} onClose={() => setDialog(null)} />
      )}
      {dialog === 'cancel' && <CancelDialog order={order} onClose={() => setDialog(null)} />}
    </Section>
  );
}

function HeaderDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const update = useUpdateOrder(order.id);
  const [form, setForm] = useState({ customer: order.customer, comment: order.comment });
  const errors = isApiError(update.error, 422) ? update.error.fields : {};
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Заказ ${order.number}`}
      actions={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            disabled={update.isPending}
            onClick={() =>
              update.mutate({ version: order.version, ...form }, { onSuccess: onClose })
            }
          >
            Сохранить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Покупатель" error={errors.customer}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              value={form.customer}
              onChange={(event) => setForm({ ...form, customer: event.target.value })}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
        <Field label="Комментарий">
          {({ id }) => (
            <TextArea
              id={id}
              value={form.comment}
              onChange={(event) => setForm({ ...form, comment: event.target.value })}
            />
          )}
        </Field>
        {update.isError && !isApiError(update.error, 422) && (
          <Notice tone="error">{update.error.message}</Notice>
        )}
      </div>
    </Dialog>
  );
}

function ResponsibleDialog({
  order,
  users,
  onClose,
}: {
  order: Order;
  users: DirectoryUser[];
  onClose: () => void;
}) {
  const update = useUpdateOrder(order.id);
  const [userId, setUserId] = useState(String(order.responsible.id));
  return (
    <Dialog
      open
      onClose={onClose}
      title="Сменить ответственного"
      description="Ответственный ведёт заказ и заполняет его этапы с исполнителем «ответственный по заказу»."
      actions={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            disabled={update.isPending || userId === String(order.responsible.id)}
            onClick={() =>
              update.mutate(
                { version: order.version, responsibleId: Number(userId) },
                { onSuccess: onClose },
              )
            }
          >
            Сохранить
          </Button>
        </>
      }
    >
      <Field label="Ответственный">
        {({ id }) => (
          <Select
            id={id}
            value={userId}
            options={users
              .filter((user) => user.isActive)
              .map((user) => ({ value: String(user.id), label: user.fullName }))}
            onChange={setUserId}
          />
        )}
      </Field>
      {update.isError && <Notice tone="error">{update.error.message}</Notice>}
    </Dialog>
  );
}

function CancelDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const cancel = useCancelOrder(order.id);
  const [reason, setReason] = useState('');
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Отменить заказ ${order.number}?`}
      description="Отменённый заказ остаётся в истории, но заполнять его этапы будет нельзя."
      actions={
        <>
          <Button onClick={onClose}>Не отменять</Button>
          <Button
            variant="danger-soft"
            disabled={cancel.isPending}
            onClick={() =>
              cancel.mutate({ version: order.version, reason }, { onSuccess: onClose })
            }
          >
            Отменить заказ
          </Button>
        </>
      }
    >
      <Field label="Причина">
        {({ id }) => (
          <TextArea id={id} value={reason} onChange={(event) => setReason(event.target.value)} />
        )}
      </Field>
      {cancel.isError && <Notice tone="error">{cancel.error.message}</Notice>}
    </Dialog>
  );
}
