import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ArrowUpDown } from 'lucide-react'
import apiClient, { type ComplianceResult, type RBIClause } from '@/lib/api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const complianceBadge = (status: string) => {
  if (status === 'Compliant') return 'success'
  if (status === 'Non-Compliant') return 'danger'
  return 'review'
}

const riskColor = (score: number) => {
  if (score <= 30) return 'bg-green-500'
  if (score <= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

interface Props {
  sessionId: number
  documentId: number
  rbiClauses: RBIClause[]
  isComplete?: boolean
}

export function ComplianceTables({ sessionId, documentId, rbiClauses, isComplete = false }: Props) {
  const [search1, setSearch1] = useState('')
  const [search2, setSearch2] = useState('')
  const [search3, setSearch3] = useState('')
  const [sortField, setSortField] = useState<'risk_score' | 'compliance_status' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['results', sessionId, documentId],
    queryFn: () => apiClient.getDocumentResults(sessionId, documentId),
    refetchInterval: isComplete ? false : 5000,
  })

  const filteredRBI = useMemo(() =>
    rbiClauses.filter(c =>
      !search1 ||
      c.clause_text.toLowerCase().includes(search1.toLowerCase()) ||
      (c.predefined_meaning || '').toLowerCase().includes(search1.toLowerCase()) ||
      (c.category || '').toLowerCase().includes(search1.toLowerCase())
    ), [rbiClauses, search1])

  const filteredResults2 = useMemo(() =>
    results.filter(r =>
      !search2 ||
      (r.ai_understanding_agreement || '').toLowerCase().includes(search2.toLowerCase())
    ), [results, search2])

  const sortedResults3 = useMemo(() => {
    let filtered = results.filter(r =>
      !search3 ||
      r.compliance_status.toLowerCase().includes(search3.toLowerCase()) ||
      (r.agreement_reference || '').toLowerCase().includes(search3.toLowerCase())
    )
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortField]
        const bVal = b[sortField]
        const dir = sortDir === 'asc' ? 1 : -1
        if (typeof aVal === 'number') return ((aVal as number) - (bVal as number)) * dir
        return String(aVal).localeCompare(String(bVal)) * dir
      })
    }
    return filtered
  }, [results, search3, sortField, sortDir])

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        Loading compliance data...
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm text-gray-800">Table 1 — RBI Clauses</h4>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Search RBI clauses..."
              value={search1}
              onChange={e => setSearch1(e.target.value)}
            />
          </div>
        </div>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-800 hover:bg-slate-800">
                <TableHead className="text-white font-semibold w-12">#</TableHead>
                <TableHead className="text-white font-semibold">RBI Clause</TableHead>
                <TableHead className="text-white font-semibold">Predefined Meaning</TableHead>
                <TableHead className="text-white font-semibold">AI Understanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRBI.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-sm">No clauses found</TableCell></TableRow>
              ) : filteredRBI.map((clause, i) => (
                <TableRow key={clause.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <TableCell className="text-center font-medium text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="text-xs max-w-xs">
                    {clause.category && (
                      <span className="inline-block text-xs font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5 mb-1">{clause.category}</span>
                    )}
                    <p className="text-gray-800 leading-relaxed">{clause.clause_text}</p>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600 max-w-xs">{clause.predefined_meaning || '—'}</TableCell>
                  <TableCell className="text-xs text-gray-600 max-w-xs">{clause.ai_understanding || <span className="text-muted-foreground italic">Not yet analyzed</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm text-gray-800">Table 2 — Agreement Clause Analysis</h4>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Search analysis..."
              value={search2}
              onChange={e => setSearch2(e.target.value)}
            />
          </div>
        </div>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-800 hover:bg-slate-800">
                <TableHead className="text-white font-semibold w-12">#</TableHead>
                <TableHead className="text-white font-semibold">RBI Clause Reference</TableHead>
                <TableHead className="text-white font-semibold">AI Understanding of Agreement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">
                  {results.length === 0 ? 'AI analysis in progress or not yet started...' : 'No results found'}
                </TableCell></TableRow>
              ) : filteredResults2.map((result, i) => (
                <TableRow key={result.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <TableCell className="text-center font-medium text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="text-xs font-medium text-primary">RBI Clause #{result.rbi_clause_id}</TableCell>
                  <TableCell className="text-xs text-gray-600 max-w-xl">{result.ai_understanding_agreement || <span className="text-muted-foreground italic">Analyzing...</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm text-gray-800">Table 3 — Compliance Report</h4>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Search compliance..."
              value={search3}
              onChange={e => setSearch3(e.target.value)}
            />
          </div>
        </div>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-800 hover:bg-slate-800">
                <TableHead className="text-white font-semibold w-12">#</TableHead>
                <TableHead className="text-white font-semibold">RBI Clause Ref</TableHead>
                <TableHead
                  className="text-white font-semibold cursor-pointer select-none"
                  onClick={() => toggleSort('compliance_status')}
                >
                  <div className="flex items-center gap-1">Compliance Status <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead
                  className="text-white font-semibold cursor-pointer select-none"
                  onClick={() => toggleSort('risk_score')}
                >
                  <div className="flex items-center gap-1">Risk Score <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="text-white font-semibold">Agreement Reference Point</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedResults3.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                  {results.length === 0 ? 'Compliance analysis pending...' : 'No results found'}
                </TableCell></TableRow>
              ) : sortedResults3.map((result, i) => (
                <TableRow key={result.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <TableCell className="text-center font-medium text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="text-xs font-medium text-primary">RBI #{result.rbi_clause_id}</TableCell>
                  <TableCell>
                    <Badge variant={complianceBadge(result.compliance_status) as any}>
                      {result.compliance_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={cn("absolute left-0 top-0 h-full rounded-full transition-all", riskColor(result.risk_score))}
                          style={{ width: `${result.risk_score}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-12 text-right">{result.risk_score.toFixed(0)}/100</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600 max-w-sm">{result.agreement_reference || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
