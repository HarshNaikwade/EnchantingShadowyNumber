import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Pencil, Shield, ArrowLeft, Loader2, Check, X } from 'lucide-react'
import apiClient, { RBIClause, RBIClausePayload } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { OllamaStatusBar } from '@/components/OllamaWarning'

const CATEGORIES = [
  'Transparency & Disclosure',
  'Consumer Protection',
  'Grievance Redressal',
  'Data Privacy & Security',
  'Fair Practices & Recovery',
  'Key Facts Statement',
  'Foreign Exchange Compliance',
  'Other',
]

const emptyForm = (): RBIClausePayload => ({
  clause_text: '',
  predefined_meaning: '',
  category: '',
})

export default function RBIClausesSettings() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<RBIClause | null>(null)
  const [form, setForm] = useState<RBIClausePayload>(emptyForm())
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const { data: clauses = [], isLoading } = useQuery({
    queryKey: ['clauses'],
    queryFn: apiClient.listClauses,
  })

  const createMutation = useMutation({
    mutationFn: apiClient.createClause,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clauses'] })
      closeDialog()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<RBIClausePayload> }) =>
      apiClient.updateClause(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clauses'] })
      closeDialog()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteClause,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clauses'] })
      setDeleteConfirm(null)
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setShowDialog(true)
  }

  const openEdit = (clause: RBIClause) => {
    setEditing(clause)
    setForm({
      clause_text: clause.clause_text,
      predefined_meaning: clause.predefined_meaning ?? '',
      category: clause.category ?? '',
    })
    setShowDialog(true)
  }

  const closeDialog = () => {
    setShowDialog(false)
    setEditing(null)
    setForm(emptyForm())
  }

  const handleSave = () => {
    const payload: RBIClausePayload = {
      clause_text: form.clause_text.trim(),
      predefined_meaning: form.predefined_meaning?.trim() || undefined,
      category: form.category?.trim() || undefined,
    }
    if (!payload.clause_text) return
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">RBI Compliance Checker</h1>
                <p className="text-xs text-muted-foreground">Global RBI Clause Settings</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <OllamaStatusBar />
              <Button variant="outline" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">RBI Clauses</h2>
            <p className="text-muted-foreground mt-1">
              Define the global set of RBI clauses used across all compliance analyses.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Clause
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : clauses.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No RBI Clauses Defined</h3>
            <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
              Add your first RBI clause to use it in compliance analysis sessions.
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Clause
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {clauses.map((clause) => (
              <Card key={clause.id} className="group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {clause.category && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {clause.category}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">#{clause.id}</span>
                      </div>
                      <CardTitle className="text-sm font-medium leading-snug text-gray-900">
                        {clause.clause_text}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(clause)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {deleteConfirm === clause.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(clause.id)}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(clause.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {clause.predefined_meaning && (
                  <CardContent className="pt-0 pb-3">
                    <p className="text-xs text-muted-foreground leading-relaxed border-t pt-2">
                      <span className="font-medium text-gray-600">Meaning: </span>
                      {clause.predefined_meaning}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={showDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit RBI Clause' : 'Add RBI Clause'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="clause_text">
                Clause Text <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="clause_text"
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                placeholder="Enter the full RBI clause text..."
                value={form.clause_text}
                onChange={(e) => setForm((f) => ({ ...f, clause_text: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="predefined_meaning">Meaning</Label>
              <textarea
                id="predefined_meaning"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                placeholder="Plain-language explanation of what this clause means..."
                value={form.predefined_meaning ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, predefined_meaning: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <div className="flex gap-2">
                <Input
                  id="category"
                  list="category-options"
                  placeholder="e.g. Consumer Protection"
                  value={form.category ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
                <datalist id="category-options">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: c }))}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      form.category === c
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-primary'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.clause_text.trim() || isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? 'Save Changes' : 'Add Clause'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
