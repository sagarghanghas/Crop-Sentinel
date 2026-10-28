import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wallet, Plus, Edit3, Trash2, Info, X } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { budgetApi, fieldsApi } from '@/services/cropsentinel'
import { useWeatherStore } from '@/store/weatherStore'
import { useI18n } from '@/i18n/translations'
import SpeakButton from '@/components/common/SpeakButton'
import type { BudgetItem, BudgetItemCreatePayload } from '@/types'

const CATEGORIES = [
  'Seeds',
  'Fertilizer',
  'Irrigation',
  'Labor',
  'Equipment',
  'Crop Protection',
  'Other',
]

export default function BudgetManthan() {
  const queryClient = useQueryClient()
  const { currencySymbol } = useWeatherStore()
  const { t } = useI18n()
  const bg = t.budget

  const [selectedFieldId, setSelectedFieldId] = useState<number | ''>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null)
  const [form, setForm] = useState<BudgetItemCreatePayload>({
    field_id: null,
    category: 'Seeds',
    item_name: '',
    planned_cost: 0,
    actual_cost: 0,
    notes: '',
    expense_date: new Date().toISOString().slice(0, 10),
  })

  const fieldsQuery = useQuery({ queryKey: ['fields'], queryFn: fieldsApi.list })
  const budgetQuery = useQuery({
    queryKey: ['budget', selectedFieldId],
    queryFn: () => budgetApi.getSummary(selectedFieldId === '' ? undefined : Number(selectedFieldId)),
  })

  const createMutation = useMutation({
    mutationFn: budgetApi.createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
      setModalOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BudgetItemCreatePayload> }) =>
      budgetApi.updateItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
      setModalOpen(false)
      setEditingItem(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: budgetApi.deleteItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
    },
  })

  const openAdd = () => {
    setEditingItem(null)
    setForm({
      field_id: selectedFieldId === '' ? null : Number(selectedFieldId),
      category: 'Seeds',
      item_name: '',
      planned_cost: 0,
      actual_cost: 0,
      notes: '',
      expense_date: new Date().toISOString().slice(0, 10),
    })
    setModalOpen(true)
  }

  const openEdit = (item: BudgetItem) => {
    setEditingItem(item)
    setForm({
      field_id: item.field_id ?? null,
      category: item.category,
      item_name: item.item_name,
      planned_cost: item.planned_cost,
      actual_cost: item.actual_cost,
      notes: item.notes,
      expense_date: item.expense_date || new Date().toISOString().slice(0, 10),
    })
    setModalOpen(true)
  }

  const summary = budgetQuery.data

  const budgetSpeechEn = `Budget Manthan Summary: Total planned spending is ${summary?.total_planned ?? 0}, total actual spending is ${summary?.total_actual ?? 0}, and remaining budget variance is ${summary?.remaining_budget ?? 0}.`
  const budgetSpeechHi = `बजट मंथन सारांश: कुल नियोजित बजट ${summary?.total_planned ?? 0} रुपये है, कुल वास्तविक खर्च ${summary?.total_actual ?? 0} रुपये है, और बचा हुआ बजट ${summary?.remaining_budget ?? 0} रुपये है।`

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">{bg.title}</h3>
          <p className="text-xs text-slate-500">{bg.subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <SpeakButton
            textEn={budgetSpeechEn}
            textHi={budgetSpeechHi}
            labelEn={bg.listenBudgetBtn}
            labelHi={bg.listenBudgetBtn}
          />
          <select
            value={selectedFieldId}
            onChange={e => setSelectedFieldId(e.target.value === '' ? '' : Number(e.target.value))}
            className="input-field py-2 text-xs w-44"
          >
            <option value="">All Fields</option>
            {(fieldsQuery.data ?? []).map(f => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button onClick={openAdd} className="btn-primary text-xs whitespace-nowrap">
            <Plus className="w-4 h-4" /> {bg.addExpenseBtn}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="metric-card">
          <span className="text-xs font-semibold text-slate-500 uppercase">{bg.totalPlanned}</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {currencySymbol}
            {(summary?.total_planned ?? 0).toLocaleString()}
          </div>
        </div>

        <div className="metric-card">
          <span className="text-xs font-semibold text-slate-500 uppercase">{bg.totalActual}</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {currencySymbol}
            {(summary?.total_actual ?? 0).toLocaleString()}
          </div>
        </div>

        <div className="metric-card">
          <span className="text-xs font-semibold text-slate-500 uppercase">{bg.remainingBudget}</span>
          <div
            className={`text-2xl font-bold mt-1 ${
              (summary?.remaining_budget ?? 0) < 0 ? 'text-red-700' : 'text-emerald-800'
            }`}
          >
            {currencySymbol}
            {(summary?.remaining_budget ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Honest Profitability Note */}
      <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center gap-2.5">
        <Info className="w-4 h-4 text-[#14532d] flex-shrink-0" />
        <span>{summary?.profitability_note}</span>
      </div>

      {/* Chart + Expense Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="chart-container">
          <h4 className="section-title mb-4">Planned vs. Actual</h4>
          {(summary?.by_category ?? []).length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">No items yet</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary?.by_category ?? []} margin={{ left: -15, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="planned" name="Planned" fill="#64748b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="Actual" fill="#14532d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="surface-card p-5 lg:col-span-2 overflow-x-auto">
          <h4 className="section-title mb-4">Expense Ledger ({summary?.items.length ?? 0})</h4>
          {(summary?.items ?? []).length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 space-y-2">
              <Wallet className="w-8 h-8 text-slate-300 mx-auto" />
              <p>No budget items recorded yet.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 uppercase">
                  <th className="pb-2.5">Item</th>
                  <th className="pb-2.5">Category</th>
                  <th className="pb-2.5">Field</th>
                  <th className="pb-2.5">Planned</th>
                  <th className="pb-2.5">Actual</th>
                  <th className="pb-2.5">Variance</th>
                  <th className="pb-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(summary?.items ?? []).map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3 font-semibold text-slate-900">{item.item_name}</td>
                    <td className="py-3">
                      <span className="badge badge-info">{item.category}</span>
                    </td>
                    <td className="py-3 text-slate-600">{item.field_name || 'All Fields'}</td>
                    <td className="py-3 text-slate-700">
                      {currencySymbol}
                      {item.planned_cost.toLocaleString()}
                    </td>
                    <td className="py-3 font-semibold text-slate-900">
                      {currencySymbol}
                      {item.actual_cost.toLocaleString()}
                    </td>
                    <td
                      className={`py-3 font-semibold ${
                        item.variance < 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {item.variance >= 0 ? '+' : ''}
                      {currencySymbol}
                      {item.variance.toLocaleString()}
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={e => {
              e.preventDefault()
              if (!form.item_name.trim()) return
              if (editingItem) {
                updateMutation.mutate({ id: editingItem.id, data: form })
              } else {
                createMutation.mutate(form)
              }
            }}
            className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900 text-base">{bg.addExpenseBtn}</h4>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-text">Category *</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="input-field"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-text">Field</label>
                <select
                  value={form.field_id ?? ''}
                  onChange={e =>
                    setForm({ ...form, field_id: e.target.value === '' ? null : Number(e.target.value) })
                  }
                  className="input-field"
                >
                  <option value="">All Fields</option>
                  {(fieldsQuery.data ?? []).map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label-text">Item Description *</label>
              <input
                type="text"
                value={form.item_name}
                onChange={e => setForm({ ...form, item_name: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-text">Planned Cost ({currencySymbol}) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.planned_cost}
                  onChange={e => setForm({ ...form, planned_cost: parseFloat(e.target.value) || 0 })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label-text">Actual Cost ({currencySymbol}) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.actual_cost}
                  onChange={e => setForm({ ...form, actual_cost: parseFloat(e.target.value) || 0 })}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
                {t.fields.cancelBtn}
              </button>
              <button type="submit" className="btn-primary">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
