import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardCheck,
  Sparkles,
  Plus,
  Trash2,
  ShieldAlert,
  Coins,
  Droplets,
  Clock,
  Compass,
  CheckCircle2,
  Sliders,
  AlertTriangle,
  Flame,
} from 'lucide-react'
import { fieldsApi, plannerApi, historyApi } from '@/services/cropsentinel'
import { useWeatherStore } from '@/store/weatherStore'
import { useI18n } from '@/i18n/translations'
import SpeakButton from '@/components/common/SpeakButton'
import type { RescueTask, RescueOptimizerPayload } from '@/types'

export default function RescuePlanner() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currencySymbol } = useWeatherStore()
  const { language, t } = useI18n()
  const isHi = language === 'hi'
  const pl = t.planner

  const [selectedFieldId, setSelectedFieldId] = useState<number | ''>('')
  const [newTaskModal, setNewTaskModal] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskReason, setTaskReason] = useState('')
  const [taskUrgency, setTaskUrgency] = useState('high')
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({})

  // Optimizer Constraints State
  const [optBudget, setOptBudget] = useState<number>(5000)
  const [optWater, setOptWater] = useState<number>(4000)
  const [optLabor, setOptLabor] = useState<number>(8)
  const [optZeroBudget, setOptZeroBudget] = useState<boolean>(false)

  const fieldsQuery = useQuery({ queryKey: ['fields'], queryFn: fieldsApi.list })

  const selectedField = fieldsQuery.data?.find(f => f.id === Number(selectedFieldId))

  const optimizerMutation = useMutation({
    mutationFn: plannerApi.optimizeInterventions,
  })

  // Auto-run optimizer when field or constraints change
  useEffect(() => {
    optimizerMutation.mutate({
      field_id: selectedField ? selectedField.id : undefined,
      crop_name: selectedField ? selectedField.crop_type : 'Wheat',
      growth_stage: selectedField ? selectedField.growth_stage : 'Vegetative',
      active_risk_type: 'general_stress',
      available_budget_inr: optZeroBudget ? 0 : optBudget,
      available_water_liters: optWater,
      available_labor_hours: optLabor,
      zero_budget_only: optZeroBudget,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFieldId, optBudget, optWater, optLabor, optZeroBudget])

  useEffect(() => {
    const fId = searchParams.get('field_id')
    if (fId) setSelectedFieldId(Number(fId))
  }, [searchParams])

  const tasksQuery = useQuery({
    queryKey: ['planner-tasks', selectedFieldId],
    queryFn: () =>
      plannerApi.listTasks(selectedFieldId === '' ? undefined : { field_id: Number(selectedFieldId) }),
  })

  const latestAssessmentQuery = useQuery({
    queryKey: ['latest-field-assessment', selectedFieldId],
    queryFn: () => historyApi.list({ field_id: Number(selectedFieldId) }),
    enabled: selectedFieldId !== '',
  })

  const generateMutation = useMutation({
    mutationFn: (fId: number) => plannerApi.generateForField(fId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planner-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: plannerApi.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planner-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
      setNewTaskModal(false)
      setTaskTitle('')
      setTaskReason('')
    },
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, status, completion_notes }: { id: number; status: string; completion_notes?: string }) =>
      plannerApi.updateTask(id, { status, completion_notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planner-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: plannerApi.deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planner-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
    },
  })

  const tasks = tasksQuery.data ?? []
  const completedCount = tasks.filter(t => t.status === 'completed').length
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0
  const latestAssessment = latestAssessmentQuery.data?.[0]

  const grouped: Record<string, RescueTask[]> = {
    immediate: tasks.filter(t => t.urgency === 'immediate'),
    high: tasks.filter(t => t.urgency === 'high'),
    medium: tasks.filter(t => t.urgency === 'medium'),
    routine: tasks.filter(t => t.urgency === 'routine'),
  }

  const pendingList = tasks.filter(t => t.status !== 'completed')
  const tasksSpeechEn =
    pendingList.length > 0
      ? `You have ${pendingList.length} pending rescue tasks. ${pendingList
          .slice(0, 3)
          .map((t, i) => `Task ${i + 1}: ${t.title}. Reason: ${t.reason}`)
          .join(' ')}`
      : 'There are no pending rescue tasks right now. Select a field and tap Generate Plan from Evidence to create tasks.'

  const tasksSpeechHi =
    pendingList.length > 0
      ? `आपके ${pendingList.length} बचाव कार्य बाकी हैं। ${pendingList
          .slice(0, 3)
          .map((t, i) => `कार्य ${i + 1}: ${t.title}। कारण: ${t.reason}`)
          .join(' ')}`
      : 'अभी कोई बचाव कार्य बाकी नहीं है। अपना खेत चुनें और कार्य योजना बनाएं बटन दबाएं।'

  return (
    <div className="space-y-6">
      {/* Safety Advisory Banner */}
      <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#14532d] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">{pl.bannerTitle}</p>
            <p className="mt-0.5">{pl.bannerDesc}</p>
          </div>
        </div>
        <SpeakButton
          textEn={tasksSpeechEn}
          textHi={tasksSpeechHi}
          labelEn={pl.listenTasksBtn}
          labelHi="सलाह सुनें"
        />
      </div>

      {/* Controls & Field Selector */}
      <div className="surface-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="w-full sm:w-64">
            <label className="label-text">{pl.selectFieldLabel}</label>
            <select
              value={selectedFieldId}
              onChange={e => setSelectedFieldId(e.target.value === '' ? '' : Number(e.target.value))}
              className="input-field"
            >
              <option value="">All Fields ({tasks.length})</option>
              {(fieldsQuery.data ?? []).map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.crop_type} · {f.growth_stage})
                </option>
              ))}
            </select>
          </div>

          {selectedFieldId !== '' && (
            <div className="text-xs text-slate-600 bg-[#f7f9f6] p-3 rounded-xl border border-slate-200 flex-1">
              <span className="font-bold text-slate-800 block">Latest Field Assessment:</span>
              {latestAssessment ? (
                <span>
                  {latestAssessment.predicted_condition || latestAssessment.analysis_status} · Risk:{' '}
                  <strong>{latestAssessment.risk_category.toUpperCase()}</strong>
                </span>
              ) : (
                <span>
                  {language === 'hi'
                    ? 'इस खेत की अभी कोई जांच नहीं हुई है।'
                    : 'No assessment logged for this field yet.'}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {selectedFieldId !== '' && (
            <button
              onClick={() => generateMutation.mutate(Number(selectedFieldId))}
              disabled={generateMutation.isPending}
              className="btn-primary text-xs"
            >
              <Sparkles className="w-3.5 h-3.5" /> {pl.generatePlanBtn}
            </button>
          )}
          <button onClick={() => setNewTaskModal(true)} className="btn-secondary text-xs">
            <Plus className="w-3.5 h-3.5" /> {pl.addCustomTaskBtn}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="surface-card p-5 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
          <span>{pl.progressLabel}</span>
          <span>
            {completedCount} / {tasks.length} ({progressPct}%)
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#14532d] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ─── RESOURCE-AWARE RESCUE OPTIMIZER SECTION ───────────────────── */}
      <div className="surface-card p-5 space-y-5 border-2 border-emerald-500/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                {isHi ? 'संसाधन-आधारित अनुकूलक' : 'Constraint Optimizer'}
              </span>
              <h3 className="font-bold text-base text-stone-900">
                {isHi ? 'फसल बचाव अनुकूलक एवं शून्य-बजट मोड' : 'Crop Rescue Optimizer & Zero-Budget Engine'}
              </h3>
            </div>
            <p className="text-xs text-stone-600 mt-0.5">
              {isHi
                ? 'कठोर बजट, पानी एवं श्रम सीमाओं के आधार पर कार्यों की व्यवहार्यता व प्राथमिकता तय करें।'
                : 'Filter and rank agronomic interventions strictly within hard resource constraints.'}
            </p>
          </div>

          {/* Zero Budget Toggle */}
          <button
            type="button"
            onClick={() => setOptZeroBudget(!optZeroBudget)}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 border transition-all ${
              optZeroBudget
                ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            {isHi ? 'शून्य-बजट मोड (0 रु)' : 'Zero-Budget Mode (₹0)'}
            <span
              className={`w-2 h-2 rounded-full ${optZeroBudget ? 'bg-emerald-300' : 'bg-stone-400'}`}
            />
          </button>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-200 text-xs">
          <div>
            <div className="flex justify-between text-[11px] font-medium text-stone-700 mb-1">
              <span>{isHi ? 'उपलब्ध बजट' : 'Available Budget'}</span>
              <span className={`font-bold ${optZeroBudget ? 'text-stone-400 line-through' : 'text-emerald-800'}`}>
                {currencySymbol} {optZeroBudget ? '0' : optBudget.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="50000"
              step="500"
              disabled={optZeroBudget}
              value={optBudget}
              onChange={e => setOptBudget(Number(e.target.value))}
              className="w-full accent-emerald-600 disabled:opacity-40"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-medium text-stone-700 mb-1">
              <span>{isHi ? 'उपलब्ध सिंचाई जल' : 'Available Water'}</span>
              <span className="font-bold text-sky-800">{optWater.toLocaleString()} L</span>
            </div>
            <input
              type="range"
              min="0"
              max="30000"
              step="500"
              value={optWater}
              onChange={e => setOptWater(Number(e.target.value))}
              className="w-full accent-sky-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-medium text-stone-700 mb-1">
              <span>{isHi ? 'उपलब्ध श्रम घंटे' : 'Available Labor'}</span>
              <span className="font-bold text-amber-800">{optLabor} hrs</span>
            </div>
            <input
              type="range"
              min="1"
              max="24"
              step="1"
              value={optLabor}
              onChange={e => setOptLabor(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
          </div>
        </div>

        {/* Ranked Feasible Options List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {isHi
                ? `व्यवहार्य एवं प्राथमिकता प्राप्त उपाय (${optimizerMutation.data?.ranked_options.length ?? 0})`
                : `Ranked Feasible Interventions (${optimizerMutation.data?.ranked_options.length ?? 0})`}
            </h4>
            <span className="text-[10px] text-stone-500 font-medium">
              {optZeroBudget
                ? isHi
                  ? 'केवल बिना खर्च वाले सांस्कृतिक/निवारक उपाय'
                  : 'Cultural & Sanitary Measures Only (₹0)'
                : isHi
                ? 'संसाधन अनुकूलित'
                : 'Resource-Optimized'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(optimizerMutation.data?.ranked_options ?? []).map((opt, i) => (
              <div
                key={opt.action_id}
                className="p-3.5 rounded-2xl border border-stone-200 bg-white hover:border-emerald-500 transition-all text-xs space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-stone-900 text-xs">
                      #{i + 1} {opt.title}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-900">
                      Score {opt.rank_score}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 mt-1 leading-snug">{opt.purpose}</p>

                  <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-stone-100 text-[10px] text-stone-500">
                    <div>
                      <span>Cost: </span>
                      <strong className="text-stone-800">
                        {opt.estimated_cost_inr === 0 ? '₹0 (Free)' : `₹${opt.estimated_cost_inr}`}
                      </strong>
                    </div>
                    <div>
                      <span>Water: </span>
                      <strong className="text-stone-800">{opt.water_required_liters} L</strong>
                    </div>
                    <div>
                      <span>Labor: </span>
                      <strong className="text-stone-800">{opt.labor_hours}h</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/simulator?field_id=${selectedFieldId}&crop=${selectedField?.crop_type || 'Wheat'}`
                      )
                    }
                    className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <Compass className="w-3 h-3" />
                    {isHi ? 'डिसीजन लैब में टेस्ट करें' : 'Test in Decision Lab'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      createTaskMutation.mutate({
                        field_id: selectedFieldId === '' ? undefined : Number(selectedFieldId),
                        title: opt.title,
                        reason: opt.purpose,
                        urgency: 'high',
                        due_date: new Date().toISOString().slice(0, 10),
                      })
                    }}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-emerald-50 text-emerald-900 border border-stone-200 text-[10px] font-bold"
                  >
                    + {isHi ? 'कार्य सूची में जोड़ें' : 'Add to Tasks'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Excluded Infeasible Items */}
          {optimizerMutation.data && optimizerMutation.data.infeasible_options_excluded.length > 0 && (
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-stone-600 space-y-1">
              <span className="font-bold text-stone-800 block text-[10px] uppercase tracking-wider">
                {isHi ? 'सीमाओं के कारण बाहर किए गए उपाय:' : 'Excluded Infeasible Options (Exceeded Constraints):'}
              </span>
              <ul className="list-disc pl-4 space-y-0.5">
                {optimizerMutation.data.infeasible_options_excluded.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Tasks Grouped by Urgency */}
      {tasks.length === 0 ? (
        <div className="surface-card p-12 text-center space-y-3">
          <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-base font-bold text-slate-800">{pl.noTasksTitle}</h4>
        </div>
      ) : (
        <div className="space-y-5">
          {(['immediate', 'high', 'medium', 'routine'] as const).map(urg => {
            const list = grouped[urg]
            if (!list || list.length === 0) return null
            return (
              <div key={urg} className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <span
                    className={`badge ${
                      urg === 'immediate' || urg === 'high' ? 'badge-high-risk' : 'badge-watch'
                    }`}
                  >
                    {urg} urgency ({list.length})
                  </span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {list.map(task => (
                    <div key={task.id} className="surface-card p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5
                            className={`text-sm font-bold ${
                              task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {task.title}
                          </h5>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Field: <strong>{task.field_name || 'General'}</strong> · {task.evidence_source} · Due: {task.due_date || '—'}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteTaskMutation.mutate(task.id)}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {task.reason}
                      </p>

                      <div>
                        <input
                          type="text"
                          value={notesDraft[task.id] ?? task.completion_notes ?? ''}
                          onChange={e => setNotesDraft({ ...notesDraft, [task.id]: e.target.value })}
                          placeholder={
                            language === 'hi'
                              ? 'कार्य पूरा करने का नोट लिखें…'
                              : 'Add field verification or completion notes…'
                          }
                          className="input-field py-1.5 text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-semibold uppercase text-slate-500">
                          {task.status.replace('_', ' ')}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {(['pending', 'in_progress', 'completed'] as const).map(st => (
                            <button
                              key={st}
                              onClick={() =>
                                updateTaskMutation.mutate({
                                  id: task.id,
                                  status: st,
                                  completion_notes: notesDraft[task.id] ?? task.completion_notes,
                                })
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                                task.status === st
                                  ? 'bg-[#14532d] text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {st === 'pending' ? 'Pending' : st === 'in_progress' ? 'In Progress' : 'Completed'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Custom Task Modal */}
      {newTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={e => {
              e.preventDefault()
              if (!taskTitle.trim() || !taskReason.trim()) return
              createTaskMutation.mutate({
                field_id: selectedFieldId === '' ? null : Number(selectedFieldId),
                title: taskTitle,
                reason: taskReason,
                urgency: taskUrgency,
                due_date: taskDueDate,
              })
            }}
            className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"
          >
            <h4 className="font-bold text-slate-900 text-base">{pl.addCustomTaskBtn}</h4>
            <div>
              <label className="label-text">Task Title *</label>
              <input
                type="text"
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label-text">Reason *</label>
              <textarea
                rows={3}
                value={taskReason}
                onChange={e => setTaskReason(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-text">Urgency</label>
                <select
                  value={taskUrgency}
                  onChange={e => setTaskUrgency(e.target.value)}
                  className="input-field"
                >
                  <option value="immediate">Immediate</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="routine">Routine</option>
                </select>
              </div>
              <div>
                <label className="label-text">Due Date</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={e => setTaskDueDate(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setNewTaskModal(false)} className="btn-secondary">
                {t.fields.cancelBtn}
              </button>
              <button type="submit" disabled={createTaskMutation.isPending} className="btn-primary">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
