import { Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { isApiError } from '../../api/client.ts';
import { useCreateOrder } from '../../api/orders.ts';
import { useTemplates } from '../../api/templates.ts';
import { TextInput } from '../../components/input.tsx';
import { Page } from '../../components/page.tsx';
import { Radio } from '../../components/radio.tsx';
import { SaveBar } from '../../components/save-bar.tsx';
import { Section } from '../../components/section.tsx';
import { LoadError, Loading } from '../../components/status.tsx';
import { TextArea } from '../../components/textarea.tsx';
import { Field } from '../../components/ui.tsx';

export function OrderNewPage() {
  const navigate = useNavigate();
  const templates = useTemplates();
  const create = useCreateOrder();
  const active = templates.data?.filter((template) => !template.archived) ?? [];
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [form, setForm] = useState({ customer: '', comment: '' });
  const errors = isApiError(create.error, 422) ? create.error.fields : {};
  // Один шаблон — выбирать нечего.
  const chosen = templateId ?? (active.length === 1 ? (active[0]?.id ?? null) : null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (create.isPending) return;
    create.mutate(
      { templateId: chosen ?? 0, ...form },
      { onSuccess: (order) => navigate(`/orders/${order.id}`, { replace: true }) },
    );
  };

  return (
    <Page title="Новый заказ" width="narrow" back={{ to: '/orders', label: 'Заказы' }}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-8">
        <Section title="Покупатель">
          <div className="flex flex-col gap-4">
            <Field label="Покупатель" error={errors.customer}>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  value={form.customer}
                  onChange={(event) => setForm({ ...form, customer: event.target.value })}
                  autoFocus
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
          </div>
        </Section>
        <Section
          title="Шаблон"
          description="По каким этапам пойдёт заказ"
          bar={
            <SaveBar
              open
              error={
                errors.templateId ??
                (create.isError && !isApiError(create.error, 422)
                  ? create.error.message
                  : undefined)
              }
              submitLabel="Создать заказ"
              message="Вы станете ответственным за заказ"
              icon={Plus}
              onReset={() => navigate('/orders')}
            />
          }
        >
          {templates.isPending && <Loading />}
          {templates.isError && (
            <LoadError error={templates.error} onRetry={() => void templates.refetch()} />
          )}
          {templates.data && active.length === 0 && (
            <p className="text-[13px] text-subtle">
              Шаблонов нет — их создают в разделе «Шаблоны».
            </p>
          )}
          {/* Пустой список не рендерим: его отрицательный отступ съел бы низ карточки. */}
          {active.length > 0 && (
            <div role="radiogroup" aria-label="Шаблон" className="-m-1.5 flex flex-col">
              {active.map((template) => (
                <Radio
                  key={template.id}
                  name="template"
                  checked={chosen === template.id}
                  onSelect={() => setTemplateId(template.id)}
                  label={template.name}
                  description={template.stages.map((stage) => stage.name).join(' → ')}
                />
              ))}
            </div>
          )}
        </Section>
      </form>
    </Page>
  );
}
