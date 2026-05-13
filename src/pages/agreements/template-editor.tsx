import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Save, Variable, PenTool, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAgreementTemplate,
  useUpdateAgreementTemplate,
  type FieldLayoutItem,
  type FieldLayout,
} from '@/lib/hooks/use-agreement-templates';

const VARIABLES = [
  { key: 'client.companyName', label: 'Company Name' },
  { key: 'client.companyNumber', label: 'Company Number' },
  { key: 'client.vatNumber', label: 'VAT Number' },
  { key: 'client.contactName', label: 'Contact Name' },
  { key: 'client.contactEmail', label: 'Contact Email' },
  { key: 'client.contactPhone', label: 'Contact Phone' },
  { key: 'client.address', label: 'Address (full)' },
  { key: 'client.leadPrice', label: 'Lead Price' },
  { key: 'client.paymentTermsDays', label: 'Payment Terms' },
  { key: 'client.billingWorkflow', label: 'Billing Workflow' },
  { key: 'today', label: 'Today' },
  { key: 'agreement.effectiveDate', label: 'Effective Date' },
];

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: template, isLoading } = useAgreementTemplate(id!);
  const update = useUpdateAgreementTemplate();
  const [layout, setLayout] = useState<FieldLayout>([]);

  useEffect(() => {
    if (template) setLayout(template.fieldLayout);
  }, [template]);

  if (isLoading || !template) {
    return <Skeleton className="h-96" />;
  }

  async function handleSave() {
    try {
      await update.mutateAsync({ id: id!, fieldLayout: layout });
      toast.success('Template saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  }

  function addField(field: FieldLayoutItem) {
    setLayout((prev) => [...prev, field]);
  }

  function removeField(fid: string) {
    setLayout((prev) => prev.filter((f) => f.id !== fid));
  }

  return (
    <div className="flex flex-col gap-4 h-screen">
      <div className="flex items-center gap-4">
        <Link to="/agreements/templates"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <div className="flex-1">
          <PageHeader title={template.name} description={template.description ?? 'Drag fields onto the PDF'}>
            <Button onClick={handleSave} disabled={update.isPending}>
              <Save className="size-4 mr-1.5" /> Save Template
            </Button>
          </PageHeader>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <div className="col-span-3 overflow-y-auto">
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Variable className="size-4" /> Variables</h3>
              <p className="text-xs text-muted-foreground">Click to add to page 0 at a default position.</p>
              <div className="space-y-1">
                {VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    className="w-full text-left text-sm px-2 py-1.5 hover:bg-muted rounded-md transition-colors"
                    onClick={() => addField({
                      id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                      type: 'variable',
                      variableKey: v.key,
                      page: 0,
                      xPct: 0.1,
                      yPct: 0.1 + (layout.length * 0.05) % 0.7,
                      widthPct: 0.3,
                      heightPct: 0.03,
                      fontSize: 11,
                    })}
                  >
                    <span className="font-mono text-xs text-primary">{v.key}</span>
                    <br />
                    <span className="text-xs text-muted-foreground">{v.label}</span>
                  </button>
                ))}
              </div>

              <hr className="my-3" />

              <h3 className="font-semibold text-sm flex items-center gap-2"><PenTool className="size-4" /> Signer fields</h3>
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                onClick={() => addField({
                  id: `f-${Date.now()}-sig`,
                  type: 'signature',
                  page: 0,
                  xPct: 0.1,
                  yPct: 0.8,
                  widthPct: 0.3,
                  heightPct: 0.05,
                })}
              >
                <PenTool className="size-3.5 mr-1.5" /> Add signature box
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                onClick={() => addField({
                  id: `f-${Date.now()}-date`,
                  type: 'date_signed',
                  page: 0,
                  xPct: 0.5,
                  yPct: 0.8,
                  widthPct: 0.2,
                  heightPct: 0.03,
                })}
              >
                <Calendar className="size-3.5 mr-1.5" /> Add date_signed
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-9 overflow-y-auto">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2">PDF preview</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {layout.length} field{layout.length === 1 ? '' : 's'} placed.
                Full drag-onto-PDF canvas extends #47-50 in a polish PR; v1 ships list mode.
              </p>
              <div className="space-y-1 text-sm">
                {layout.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2 border rounded">
                    <span className="font-mono text-xs">
                      {f.type === 'variable' && `{{${f.variableKey}}}`}
                      {f.type === 'text' && `"${f.text}"`}
                      {f.type === 'signature' && '✍️ signature'}
                      {f.type === 'date_signed' && '📅 date_signed'}
                      {' — page '}{f.page}{' @ '}({f.xPct.toFixed(2)}, {f.yPct.toFixed(2)})
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => removeField(f.id)}>Remove</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
