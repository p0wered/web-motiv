import { plural, type Stage, type Template } from '@webmotiv/shared';
import { Plus, Save } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { isApiError } from '../../api/client.ts';
import { useStages } from '../../api/stages.ts';
import {
  useCreateTemplate,
  useDeleteTemplate,
  useTemplates,
  useUpdateTemplate,
} from '../../api/templates.ts';
import { Badge } from '../../components/badge.tsx';
import { TextInput } from '../../components/input.tsx';
import { Page } from '../../components/page.tsx';
import { SaveBar } from '../../components/save-bar.tsx';
import { SaveStatus, Section } from '../../components/section.tsx';
import { LoadError, Loading } from '../../components/status.tsx';
import { TextArea } from '../../components/textarea.tsx';
import { Field, Notice } from '../../components/ui.tsx';
import { ArchiveSection } from '../catalog/archive-section.tsx';
import { TemplateStagesEditor } from './template-stages-editor.tsx';

const BACK = { to: '/templates', label: 'Шаблоны' };

const barError = (error: Error | null) =>
  !error ? undefined : isApiError(error, 422) ? 'Проверьте выделенные поля.' : error.message;

const formErrors = (error: Error | null) => (isApiError(error, 422) ? error.fields : {});

const STAGES_DESCRIPTION = 'Заказ проходит этапы строго по порядку';

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

/** Библиотека этапов нужна редактору для названий и исполнителей. */
function WithLibrary({ children }: { children: (library: Stage[]) => ReactNode }) {
  const stages = useStages();
  if (stages.isPending) return <Loading />;
  if (stages.isError)
    return <LoadError error={stages.error} onRetry={() => void stages.refetch()} />;
  return children(stages.data);
}

export function TemplateNewPage() {
  const navigate = useNavigate();
  const create = useCreateTemplate();
  const [info, setInfo] = useState<Info>({ name: '', description: '' });
  const [stageIds, setStageIds] = useState<number[]>([]);
  const errors = formErrors(create.error);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (create.isPending) return;
    create.mutate(
      { ...info, stageIds },
      { onSuccess: (template) => navigate(`/templates/${template.id}`, { replace: true }) },
    );
  };

  return (
    <Page title="Новый шаблон" width="narrow" back={BACK}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-8">
        <Section title="Шаблон">
          <InfoFields value={info} onChange={setInfo} errors={errors} autoFocus />
        </Section>
        <Section
          title="Этапы"
          description={STAGES_DESCRIPTION}
          bar={
            <SaveBar
              open
              error={errors.stageIds ?? barError(create.error)}
              submitLabel="Создать шаблон"
              message="По шаблону можно будет создавать заказы"
              icon={Plus}
              onReset={() => navigate('/templates')}
            />
          }
        >
          <WithLibrary>
            {(library) => (
              <TemplateStagesEditor stageIds={stageIds} onChange={setStageIds} library={library} />
            )}
          </WithLibrary>
        </Section>
      </form>
    </Page>
  );
}

function InfoSection({ template }: { template: Template }) {
  const saved = { name: template.name, description: template.description };
  const [info, setInfo] = useState(saved);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const update = useUpdateTemplate(template.id);
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
        title="Шаблон"
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

function StagesSection({ template }: { template: Template }) {
  const saved = template.stages.map((stage) => stage.id);
  const [stageIds, setStageIds] = useState(saved);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const update = useUpdateTemplate(template.id);
  const dirty = stageIds.join() !== saved.join();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (update.isPending) return;
    update.mutate(
      { stageIds },
      {
        onSuccess: (updated) => {
          setStageIds(updated.stages.map((stage) => stage.id));
          setSavedAt(Date.now());
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <Section
        title="Этапы"
        description={
          template.orderCount > 0
            ? `${STAGES_DESCRIPTION}. Правки действуют на новые заказы — в ${template.orderCount} ${plural(template.orderCount, ['созданном', 'созданных', 'созданных'])} останутся прежние этапы`
            : STAGES_DESCRIPTION
        }
        aside={<SaveStatus savedAt={savedAt} pending={update.isPending} />}
        bar={
          <SaveBar
            open={dirty}
            error={formErrors(update.error).stageIds ?? barError(update.error)}
            submitLabel="Сохранить"
            icon={Save}
            onReset={() => {
              update.reset();
              setStageIds(saved);
            }}
          />
        }
      >
        <WithLibrary>
          {(library) => (
            <TemplateStagesEditor stageIds={stageIds} onChange={setStageIds} library={library} />
          )}
        </WithLibrary>
      </Section>
    </form>
  );
}

function TemplateArchive({ template }: { template: Template }) {
  const navigate = useNavigate();
  const update = useUpdateTemplate(template.id);
  const remove = useDeleteTemplate(template.id);

  return (
    <ArchiveSection
      noun="шаблон"
      name={template.name}
      archived={template.archived}
      archiveBlocked={null}
      deleteBlocked={
        template.orderCount > 0
          ? 'По шаблону уже есть заказы, поэтому удалить его нельзя — только отправить в архив.'
          : null
      }
      onArchive={(archived) => update.mutate({ archived })}
      onDelete={() => remove.mutate(undefined, { onSuccess: () => navigate(BACK.to) })}
      pending={update.isPending || remove.isPending}
      error={update.error?.message ?? remove.error?.message}
    />
  );
}

export function TemplatePage() {
  const id = Number(useParams().id);
  const templates = useTemplates();
  const template = templates.data?.find((item) => item.id === id);

  return (
    <Page
      title={template?.name ?? 'Шаблон'}
      description={template?.archived && <Badge>В архиве</Badge>}
      width="narrow"
      back={BACK}
    >
      {templates.isPending && <Loading />}
      {templates.isError && (
        <LoadError error={templates.error} onRetry={() => void templates.refetch()} />
      )}
      {templates.data && !template && (
        <Notice tone="error">Шаблон не найден — возможно, его удалили.</Notice>
      )}
      {template && (
        <div key={String(template.archived)} className="flex flex-col gap-8">
          <fieldset disabled={template.archived} className="flex min-w-0 flex-col gap-8">
            <InfoSection template={template} />
            <StagesSection template={template} />
          </fieldset>
          <TemplateArchive template={template} />
        </div>
      )}
    </Page>
  );
}
