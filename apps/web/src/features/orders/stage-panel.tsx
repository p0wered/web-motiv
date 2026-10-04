import {
  type DirectoryUser,
  missingRequiredFields,
  type Order,
  type OrderFile,
  type OrderStage,
} from '@webmotiv/shared';
import { CheckCheck, Save } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { isApiError } from '../../api/client.ts';
import { useCompleteStage, useOrder, useSaveStage } from '../../api/orders.ts';
import { Button } from '../../components/button.tsx';
import { ConfirmDialog } from '../../components/dialog.tsx';
import { SaveBar } from '../../components/save-bar.tsx';
import { SaveStatus, Section } from '../../components/section.tsx';
import { Notice } from '../../components/ui.tsx';
import { formatDateTime } from '../../lib/format.ts';
import { executorLabel } from '../stages/executor-picker.tsx';
import { type Draft, draftChanged, fromDraft, toDraft } from './field-draft.ts';
import { FieldInput } from './field-input.tsx';
import { FieldValueText } from './field-value.tsx';
import { FileField } from './file-field.tsx';
import { FilePreview } from './file-preview.tsx';

const VERSION_CONFLICT = 'version_conflict';

interface StagePanelProps {
  order: Order;
  stage: OrderStage;
  users: DirectoryUser[];
}

function stageMeta(order: Order, stage: OrderStage): string {
  if (stage.status === 'done') {
    const who = stage.completedBy?.fullName ?? 'сотрудник';
    return `Выполнено: ${who}${stage.completedAt ? `, ${formatDateTime(stage.completedAt)}` : ''}`;
  }
  const executor =
    stage.executor === 'responsible'
      ? `ответственный — ${order.responsible.fullName}`
      : executorLabel(stage);
  if (order.status !== 'active') return `Исполнитель: ${executor}`;
  return stage.status === 'active' ? `Сейчас заполняет: ${executor}` : `Заполнит: ${executor}`;
}

/** Выбранный этап заказа: заполнение (если это ваш открытый этап) или просмотр. */
export function StagePanel({ order, stage, users }: StagePanelProps) {
  // key в родителе — по этапу: при переходе к другому этапу черновик начинается заново.
  const [draft, setDraft] = useState<Draft>(() => toDraft(stage.fields, stage.values));
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<OrderFile | null>(null);
  const save = useSaveStage(order.id, stage.id);
  const complete = useCompleteStage(order.id, stage.id);
  const refetch = useOrder(order.id).refetch;

  const editable = stage.canEdit;
  const dirty = editable && draftChanged(stage.fields, draft, stage.values);
  const serverErrors = {
    ...(isApiError(save.error, 422) ? save.error.fields : {}),
    ...(isApiError(complete.error, 422) ? complete.error.fields : {}),
  };
  const errors = { ...serverErrors, ...clientErrors };
  const conflict = [save.error, complete.error].some(
    (error) => isApiError(error, 409) && error.code === VERSION_CONFLICT,
  );

  const fileCounts = new Map<string, number>();
  for (const file of stage.files)
    fileCounts.set(file.fieldId, (fileCounts.get(file.fieldId) ?? 0) + 1);
  const missing = missingRequiredFields(stage.fields, stage.values, fileCounts);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (save.isPending) return;
    const { values, errors: problems } = fromDraft(stage.fields, draft);
    setClientErrors(problems);
    if (Object.keys(problems).length > 0) return;
    save.mutate(
      { version: order.version, values },
      {
        onSuccess: (updated) => {
          const fresh = updated.stages.find((item) => item.id === stage.id);
          if (fresh) setDraft(toDraft(fresh.fields, fresh.values));
          setSavedAt(Date.now());
        },
      },
    );
  };

  /** После конфликта — свежий заказ с сервера, черновик — по нему. */
  const reload = async () => {
    save.reset();
    complete.reset();
    const fresh = (await refetch()).data?.stages.find((item) => item.id === stage.id);
    if (fresh) setDraft(toDraft(fresh.fields, fresh.values));
  };

  const doneBlocked = dirty
    ? 'Сначала сохраните изменения'
    : missing.length > 0
      ? `Заполните: ${missing.map((field) => field.label).join(', ')}`
      : null;

  return (
    <form onSubmit={submit} noValidate>
      <Section
        title={stage.name}
        description={stageMeta(order, stage)}
        aside={
          editable ? (
            <div className="flex items-center gap-3">
              <SaveStatus savedAt={savedAt} pending={save.isPending} />
              <Button
                variant="primary"
                icon={CheckCheck}
                disabled={doneBlocked !== null || complete.isPending}
                title={doneBlocked ?? 'Отметить этап выполненным'}
                onClick={() => setConfirming(true)}
              >
                Готово
              </Button>
            </div>
          ) : undefined
        }
        bar={
          editable ? (
            <SaveBar
              open={dirty}
              error={
                Object.keys(errors).length > 0
                  ? 'Проверьте выделенные поля.'
                  : save.error && !conflict
                    ? save.error.message
                    : undefined
              }
              submitLabel="Сохранить"
              icon={Save}
              onReset={() => {
                save.reset();
                setClientErrors({});
                setDraft(toDraft(stage.fields, stage.values));
              }}
            />
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4">
          {stage.description && <p className="text-[13px] text-muted">{stage.description}</p>}
          {conflict && (
            <div className="flex flex-wrap items-center gap-3">
              <Notice tone="error">Заказ уже изменил другой сотрудник.</Notice>
              <Button onClick={() => void reload()}>Обновить</Button>
            </div>
          )}
          {complete.isError && !conflict && <Notice tone="error">{complete.error.message}</Notice>}

          {stage.fields.length === 0 && (
            <p className="text-[13px] text-subtle">
              {editable ? 'Полей нет — когда этап выполнен, нажмите «Готово».' : 'Полей нет.'}
            </p>
          )}

          {editable ? (
            stage.fields.map((field) =>
              field.type === 'file' ? (
                <FileField
                  key={field.id}
                  orderId={order.id}
                  stageId={stage.id}
                  field={field}
                  files={stage.files.filter((file) => file.fieldId === field.id)}
                  editable
                  onPreview={setPreview}
                  error={errors[field.id]}
                />
              ) : (
                <FieldInput
                  key={field.id}
                  field={field}
                  value={draft[field.id] ?? ''}
                  onChange={(value) => {
                    setClientErrors((current) =>
                      Object.fromEntries(
                        Object.entries(current).filter(([key]) => key !== field.id),
                      ),
                    );
                    setDraft((current) => ({ ...current, [field.id]: value }));
                  }}
                  error={errors[field.id]}
                  users={users}
                />
              ),
            )
          ) : (
            <dl className="flex flex-col gap-3">
              {stage.fields.map((field) => (
                <div key={field.id} className="flex flex-wrap gap-x-6 gap-y-0.5">
                  <dt className="w-44 shrink-0 text-[13px] text-subtle">{field.label}</dt>
                  <dd className="min-w-0 flex-1 text-sm text-fg">
                    {field.type === 'file' ? (
                      <FileField
                        orderId={order.id}
                        stageId={stage.id}
                        field={field}
                        files={stage.files.filter((file) => file.fieldId === field.id)}
                        editable={false}
                        onPreview={setPreview}
                        hideLabel
                      />
                    ) : (
                      <FieldValueText field={field} value={stage.values[field.id]} users={users} />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </Section>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          complete.mutate(order.version, {
            onSuccess: () => setConfirming(false),
            onError: () => setConfirming(false),
          })
        }
        title={`Этап «${stage.name}» выполнен?`}
        description="Заказ перейдёт к следующему этапу. Вернуться к этому этапу и изменить его будет нельзя."
        confirmLabel="Готово"
        pending={complete.isPending}
      />
      <FilePreview file={preview} onClose={() => setPreview(null)} />
    </form>
  );
}
