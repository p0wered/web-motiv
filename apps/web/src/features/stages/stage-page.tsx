import { plural, type Stage, type StageField } from '@webmotiv/shared';
import { Plus, Save } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { isApiError } from '../../api/client.ts';
import { useCreateStage, useDeleteStage, useStages, useUpdateStage } from '../../api/stages.ts';
import { Badge } from '../../components/badge.tsx';
import { TextInput } from '../../components/input.tsx';
import { Page } from '../../components/page.tsx';
import { SaveBar } from '../../components/save-bar.tsx';
import { SaveStatus, Section } from '../../components/section.tsx';
import { LoadError, Loading } from '../../components/status.tsx';
import { TextArea } from '../../components/textarea.tsx';
import { Field, Notice } from '../../components/ui.tsx';
import { ArchiveSection } from '../catalog/archive-section.tsx';
import { ExecutorPicker, type ExecutorValue } from './executor-picker.tsx';
import { FieldBuilder } from './field-builder.tsx';
import { fieldProblems } from './field-types.ts';

const BACK = { to: '/stages', label: 'Этапы' };

const barError = (error: Error | null) =>
  !error ? undefined : isApiError(error, 422) ? 'Проверьте выделенные поля.' : error.message;

const formErrors = (error: Error | null) => (isApiError(error, 422) ? error.fields : {});

interface Info {
  name: string;
  description: string;
}

function InfoFields({
  value,
  onChange,
  errors,
  autoFocus = false,
}: {
  value: Info;
  onChange: (value: Info) => void;
  errors: Record<string, string>;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Название" error={errors.name}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            value={value.name}
            onChange={(event) => onChange({ ...value, name: event.target.value })}
            autoFocus={autoFocus}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>
      <Field label="Описание" error={errors.description}>
        {({ id, describedBy, invalid }) => (
          <TextArea
            id={id}
            value={value.description}
            onChange={(event) => onChange({ ...value, description: event.target.value })}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>
    </div>
  );
}

const FIELDS_DESCRIPTION = 'Что заполняет исполнитель, прежде чем отметить этап «Готово»';

export function StageNewPage() {
  const navigate = useNavigate();
  const create = useCreateStage();
  const [info, setInfo] = useState<Info>({ name: '', description: '' });
  const [executor, setExecutor] = useState<ExecutorValue>({
    executor: 'responsible',
    executorRoleId: null,
  });
  const [fields, setFields] = useState<StageField[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const errors = formErrors(create.error);
  const problems = fieldProblems(fields);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (create.isPending || problems.size > 0) return;
    create.mutate(
      { ...info, ...executor, fields },
      { onSuccess: (stage) => navigate(`/stages/${stage.id}`, { replace: true }) },
    );
  };

  return (
    <Page title="Новый этап" width="narrow" back={BACK}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-8">
        <Section title="Этап">
          <InfoFields value={info} onChange={setInfo} errors={errors} autoFocus />
        </Section>
        <Section title="Исполнитель">
          <ExecutorPicker
            name="executor"
            value={executor}
            onChange={setExecutor}
            error={errors.executorRoleId}
          />
        </Section>
        <Section
          title="Поля"
          description={FIELDS_DESCRIPTION}
          bar={
            <SaveBar
              open
              error={
                submitted && problems.size > 0
                  ? 'Проверьте выделенные поля.'
                  : (barError(create.error) ?? errors.fields)
              }
              submitLabel="Создать этап"
              message="Этап появится в библиотеке — его можно будет добавить в шаблоны"
              icon={Plus}
              onReset={() => navigate('/stages')}
            />
          }
        >
          <FieldBuilder
            fields={fields}
            onChange={setFields}
            errors={submitted ? problems : new Map()}
          />
        </Section>
      </form>
    </Page>
  );
}

function InfoSection({ stage }: { stage: Stage }) {
  const saved = { name: stage.name, description: stage.description };
  const [info, setInfo] = useState(saved);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const update = useUpdateStage(stage.id);
  const dirty = info.name !== saved.name || info.description !== saved.description;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (update.isPending) return;
    update.mutate(info, {
      onSuccess: (updated) => {
        setInfo({ name: updated.name, description: updated.description });
        setSavedAt(Date.now());
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Section
        title="Этап"
        aside={<SaveStatus savedAt={savedAt} pending={update.isPending} />}
        bar={
          <SaveBar
            open={dirty}
            error={barError(update.error)}
            submitLabel="Сохранить"
            icon={Save}
            onReset={() => {
              update.reset();
              setInfo(saved);
            }}
          />
        }
      >
        <InfoFields value={info} onChange={setInfo} errors={formErrors(update.error)} />
      </Section>
    </form>
  );
}

function ExecutorSection({ stage }: { stage: Stage }) {
  const saved: ExecutorValue = {
    executor: stage.executor,
    executorRoleId: stage.executorRole?.id ?? null,
  };
  const [executor, setExecutor] = useState(saved);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const update = useUpdateStage(stage.id);
  const dirty =
    executor.executor !== saved.executor || executor.executorRoleId !== saved.executorRoleId;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (update.isPending) return;
    update.mutate(executor, {
      onSuccess: (updated) => {
        setExecutor({
          executor: updated.executor,
          executorRoleId: updated.executorRole?.id ?? null,
        });
        setSavedAt(Date.now());
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Section
        title="Исполнитель"
        aside={<SaveStatus savedAt={savedAt} pending={update.isPending} />}
        bar={
          <SaveBar
            open={dirty}
            error={barError(update.error)}
            submitLabel="Сохранить"
            icon={Save}
            onReset={() => {
              update.reset();
              setExecutor(saved);
            }}
          />
        }
      >
        <ExecutorPicker
          name={`executor-${stage.id}`}
          value={executor}
          onChange={setExecutor}
          error={formErrors(update.error).executorRoleId}
        />
      </Section>
    </form>
  );
}

function FieldsSection({ stage }: { stage: Stage }) {
  const [fields, setFields] = useState(stage.fields);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const update = useUpdateStage(stage.id);
  const problems = fieldProblems(fields);
  const dirty = JSON.stringify(fields) !== JSON.stringify(stage.fields);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (update.isPending || problems.size > 0) return;
    update.mutate(
      { fields },
      {
        onSuccess: (updated) => {
          // Сервер обрезает пробелы — поля должны совпасть с сохранёнными.
          setFields(updated.fields);
          setSubmitted(false);
          setSavedAt(Date.now());
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <Section
        title="Поля"
        description={FIELDS_DESCRIPTION}
        aside={<SaveStatus savedAt={savedAt} pending={update.isPending} />}
        bar={
          <SaveBar
            open={dirty}
            error={
              submitted && problems.size > 0
                ? 'Проверьте выделенные поля.'
                : (barError(update.error) ?? formErrors(update.error).fields)
            }
            submitLabel="Сохранить"
            icon={Save}
            onReset={() => {
              update.reset();
              setSubmitted(false);
              setFields(stage.fields);
            }}
          />
        }
      >
        <FieldBuilder
          fields={fields}
          onChange={setFields}
          errors={submitted ? problems : new Map()}
        />
      </Section>
    </form>
  );
}

function UsageSection({ stage }: { stage: Stage }) {
  return (
    <Section
      title="Где используется"
      description="Правки действуют на новые заказы — в уже созданных этап остаётся прежним"
    >
      <div className="flex flex-col gap-2 text-sm">
        {stage.templates.length === 0 ? (
          <p className="text-[13px] text-subtle">Ни в одном шаблоне.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {stage.templates.map((template) => (
              <li key={template.id}>
                <Link
                  to={`/templates/${template.id}`}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-sunken px-2.5 text-[13px] text-fg transition-colors hover:text-accent"
                >
                  {template.name}
                  {template.archived && <span className="text-subtle">· архив</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {stage.orderCount > 0 && (
          <p className="text-[13px] text-subtle">
            Уже в {stage.orderCount} {plural(stage.orderCount, ['заказе', 'заказах', 'заказах'])}.
          </p>
        )}
      </div>
    </Section>
  );
}

function StageArchive({ stage }: { stage: Stage }) {
  const navigate = useNavigate();
  const update = useUpdateStage(stage.id);
  const remove = useDeleteStage(stage.id);
  const activeTemplates = stage.templates.filter((template) => !template.archived);

  return (
    <ArchiveSection
      noun="этап"
      name={stage.name}
      archived={stage.archived}
      archiveBlocked={
        activeTemplates.length > 0
          ? `Этап входит в шаблоны: ${activeTemplates.map((t) => `«${t.name}»`).join(', ')}. Чтобы отправить его в архив, сначала уберите его оттуда.`
          : null
      }
      deleteBlocked={
        stage.templates.length > 0 || stage.orderCount > 0
          ? 'Этап уже используется, поэтому удалить его нельзя — только отправить в архив.'
          : null
      }
      onArchive={(archived) => update.mutate({ archived })}
      onDelete={() => remove.mutate(undefined, { onSuccess: () => navigate(BACK.to) })}
      pending={update.isPending || remove.isPending}
      error={update.error?.message ?? remove.error?.message}
    />
  );
}

export function StagePage() {
  const id = Number(useParams().id);
  const stages = useStages();
  const stage = stages.data?.find((item) => item.id === id);

  return (
    <Page
      title={stage?.name ?? 'Этап'}
      description={stage?.archived && <Badge>В архиве</Badge>}
      width="narrow"
      back={BACK}
    >
      {stages.isPending && <Loading />}
      {stages.isError && <LoadError error={stages.error} onRetry={() => void stages.refetch()} />}
      {stages.data && !stage && (
        <Notice tone="error">Этап не найден — возможно, его удалили.</Notice>
      )}
      {stage && (
        // key: архивирование и восстановление перечитывают формы с сервера.
        <div key={String(stage.archived)} className="flex flex-col gap-8">
          {/* Архивный этап — только для чтения: fieldset выключает все поля и кнопки разом. */}
          <fieldset disabled={stage.archived} className="flex min-w-0 flex-col gap-8">
            <InfoSection stage={stage} />
            <ExecutorSection stage={stage} />
            <FieldsSection stage={stage} />
          </fieldset>
          <UsageSection stage={stage} />
          <StageArchive stage={stage} />
        </div>
      )}
    </Page>
  );
}
