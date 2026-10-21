import { type GameModeEnum, listModes } from '@koarena/game'
import { useNavigate } from '@tanstack/react-router'
import { Check, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTrigger,
} from '@/components/reui/stepper'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import {
  createTournament,
  listAvailableLanguages,
} from '../tournaments.functions'
import { MODE_CONFIG_FIELDS, RUBRIC_FIELD } from './modeConfigFields'

const STEPS = [
  { id: 1, title: 'Basics' },
  { id: 2, title: 'Languages' },
  { id: 3, title: 'Scoring' },
  { id: 4, title: 'Review' },
] as const

const MODE_BLURB: Record<GameModeEnum, string> = {
  CTF: 'Challenges, flags and points that decay per solve.',
  ATTACK_DEFENSE:
    'Run a vulnerable service, attack your rivals, patch your own.',
  HACKATHON: 'Ship a project, judges score it against a rubric.',
  ACM: 'Algorithmic problems judged against hidden test cases.',
  POLYGLOT_BATTLE: 'One problem, pick your language, win on the handicap.',
  CODE_GOLF: 'The shortest correct program wins.',
  BUG_HUNT: 'Fix the seeded bug, fastest passing hidden tests wins.',
  KNOCKOUT: 'Bracketed head-to-head duels with elimination.',
}

interface LanguageOption {
  id: string
  slug: string
  name: string
  category: string
  difficultyWeight: number
}

interface Draft {
  name: string
  slug: string
  tagline: string
  description: string
  gameMode: GameModeEnum
  visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE'
  startsAt: string
  endsAt: string
  teamSizeMin: number
  teamSizeMax: number
  maxTeams: number | undefined
  languageIds: string[]
  config: Record<string, unknown>
}

function defaultDraft(): Draft {
  const now = new Date()
  const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  return {
    name: '',
    slug: '',
    tagline: '',
    description: '',
    gameMode: 'CTF',
    visibility: 'PUBLIC',
    startsAt: now.toISOString().slice(0, 16),
    endsAt: later.toISOString().slice(0, 16),
    teamSizeMin: 1,
    teamSizeMax: 5,
    maxTeams: undefined,
    languageIds: [],
    config: {},
  }
}

export interface TournamentWizardProps {
  languages: LanguageOption[]
  onComplete?: (result: { id: string; slug: string }) => void
}

export function TournamentWizard({
  languages,
  onComplete,
}: TournamentWizardProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<Draft>(defaultDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const modes = useMemo(() => listModes(), [])

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function setMode(mode: GameModeEnum) {
    // The scoring config belongs to the mode, so switching mode resets it.
    setDraft((current) => ({ ...current, gameMode: mode, config: {} }))
  }

  function configValue(key: string): number | boolean | string {
    const value = draft.config[key]
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (typeof value === 'string') return value
    return 0
  }

  function setConfigValue(key: string, value: number | boolean | string) {
    setDraft((current) => ({
      ...current,
      config: { ...current.config, [key]: value },
    }))
  }

  function setRubric(rubric: Array<Record<string, unknown>>) {
    setDraft((current) => ({
      ...current,
      config: { ...current.config, rubric },
    }))
  }

  const fields = MODE_CONFIG_FIELDS[draft.gameMode]

  const submit = async () => {
    setSaving(true)
    setError(null)

    try {
      const result = await createTournament({
        data: {
          name: draft.name,
          slug: draft.slug || undefined,
          tagline: draft.tagline || undefined,
          description: draft.description || undefined,
          gameMode: draft.gameMode,
          visibility: draft.visibility,
          startsAt: new Date(draft.startsAt),
          endsAt: new Date(draft.endsAt),
          teamSizeMin: draft.teamSizeMin,
          teamSizeMax: draft.teamSizeMax,
          maxTeams: draft.maxTeams,
          languageIds: draft.languageIds,
          config: draft.config,
        },
      })

      toast.success('Tournament created. It is still a draft.')
      onComplete?.(result)
      await navigate({
        to: '/organizer/$tournamentId',
        params: { tournamentId: result.id },
      })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not create the tournament.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <Stepper
        value={step}
        onValueChange={(next) => setStep(Number(next))}
        className="w-full"
      >
        <StepperNav>
          {STEPS.map((item, index) => (
            <StepperItem key={item.id} step={item.id}>
              <StepperTrigger>
                <StepperIndicator className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=completed]:bg-primary data-[state=completed]:text-primary-foreground data-[state=inactive]:text-muted-foreground">
                  {item.id}
                </StepperIndicator>
              </StepperTrigger>
              {index < STEPS.length - 1 ? <StepperSeparator /> : null}
            </StepperItem>
          ))}
        </StepperNav>

        <StepperPanel>
          <StepperContent value={1}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={draft.name}
                  placeholder="KoArena Autumn CTF"
                  onChange={(event) => update('name', event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="slug">URL slug</Label>
                <Input
                  id="slug"
                  value={draft.slug}
                  placeholder="autumn-ctf"
                  onChange={(event) => update('slug', event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to derive it from the name.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={draft.tagline}
                  placeholder="Six hours, eight categories, one winner."
                  onChange={(event) => update('tagline', event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={draft.description}
                  placeholder="What players should expect."
                  onChange={(event) =>
                    update('description', event.target.value)
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gameMode">Game mode</Label>
                <Select
                  value={draft.gameMode}
                  onValueChange={(value) => setMode(value as GameModeEnum)}
                >
                  <SelectTrigger id="gameMode">
                    <SelectValue placeholder="Pick a mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {modes.map((mode) => (
                      <SelectItem key={mode.enum} value={mode.enum}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {MODE_BLURB[draft.gameMode]}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="startsAt">Starts</Label>
                  <Input
                    id="startsAt"
                    type="datetime-local"
                    value={draft.startsAt}
                    onChange={(event) => update('startsAt', event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="endsAt">Ends</Label>
                  <Input
                    id="endsAt"
                    type="datetime-local"
                    value={draft.endsAt}
                    onChange={(event) => update('endsAt', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="teamSizeMin">Min team size</Label>
                  <Input
                    id="teamSizeMin"
                    type="number"
                    min={1}
                    value={draft.teamSizeMin}
                    onChange={(event) =>
                      update('teamSizeMin', Number(event.target.value))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="teamSizeMax">Max team size</Label>
                  <Input
                    id="teamSizeMax"
                    type="number"
                    min={1}
                    value={draft.teamSizeMax}
                    onChange={(event) =>
                      update('teamSizeMax', Number(event.target.value))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="maxTeams">Team limit</Label>
                  <Input
                    id="maxTeams"
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    value={draft.maxTeams ?? ''}
                    onChange={(event) =>
                      update(
                        'maxTeams',
                        event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      )
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  value={draft.visibility}
                  onValueChange={(value) =>
                    update('visibility', value as Draft['visibility'])
                  }
                >
                  <SelectTrigger id="visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">
                      Public — listed and joinable
                    </SelectItem>
                    <SelectItem value="UNLISTED">
                      Unlisted — joinable by link
                    </SelectItem>
                    <SelectItem value="PRIVATE">
                      Private — join code only
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </StepperContent>

          <StepperContent value={2}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-medium">Enabled languages</h3>
                <p className="text-xs text-muted-foreground">
                  The editor, the runner and the scoring all read this list. The
                  weight is the handicap used by Polyglot Battle.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {languages.map((language) => {
                  const checked = draft.languageIds.includes(language.id)
                  return (
                    <div
                      key={language.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2 transition-colors hover:bg-muted"
                    >
                      <Checkbox
                        id={`lang-${language.id}`}
                        checked={checked}
                        onCheckedChange={(value) =>
                          update(
                            'languageIds',
                            value === true
                              ? [...draft.languageIds, language.id]
                              : draft.languageIds.filter(
                                  (id) => id !== language.id,
                                ),
                          )
                        }
                      />
                      <Label
                        htmlFor={`lang-${language.id}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        {language.name}
                      </Label>
                      <Badge variant="outline" size="sm">
                        ×{language.difficultyWeight.toFixed(2)}
                      </Badge>
                    </div>
                  )
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                {draft.languageIds.length} language
                {draft.languageIds.length === 1 ? '' : 's'} selected.
              </p>
            </div>
          </StepperContent>

          <StepperContent value={3}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-medium">Scoring rules</h3>
                <p className="text-xs text-muted-foreground">
                  Validated by the scoring engine when you save, so a tournament
                  can never hold a config the engine would reject.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <Label htmlFor={`config-${field.key}`}>{field.label}</Label>
                    {field.type === 'boolean' ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Checkbox
                          id={`config-${field.key}`}
                          checked={configValue(field.key) === true}
                          onCheckedChange={(value) =>
                            setConfigValue(field.key, value === true)
                          }
                        />
                        <Label
                          htmlFor={`config-${field.key}`}
                          className="cursor-pointer text-sm font-normal"
                        >
                          Enabled
                        </Label>
                      </div>
                    ) : (
                      <Input
                        id={`config-${field.key}`}
                        type={field.type === 'number' ? 'number' : 'text'}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={String(configValue(field.key))}
                        onChange={(event) =>
                          setConfigValue(
                            field.key,
                            field.type === 'number'
                              ? Number(event.target.value)
                              : event.target.value,
                          )
                        }
                      />
                    )}
                    {field.hint ? (
                      <p className="text-xs text-muted-foreground">
                        {field.hint}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              {draft.gameMode === 'HACKATHON' ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="config-rubric">{RUBRIC_FIELD.label}</Label>
                  <Textarea
                    id="config-rubric"
                    rows={4}
                    placeholder={'Impact | 2 | 10\nCraft | 1 | 10'}
                    value={
                      Array.isArray(draft.config.rubric)
                        ? (
                            draft.config.rubric as Array<
                              Record<string, unknown>
                            >
                          )
                            .map(
                              (criterion) =>
                                `${criterion.name} | ${criterion.weight} | ${criterion.maxScore}`,
                            )
                            .join('\n')
                        : ''
                    }
                    onChange={(event) => {
                      const rubric = event.target.value
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line) => {
                          const [name, weight, maxScore] = line.split('|')
                          return {
                            name: name?.trim() ?? '',
                            weight: Number(weight ?? 1),
                            maxScore: Number(maxScore ?? 10),
                          }
                        })
                        .filter((criterion) => criterion.name)
                      setRubric(rubric)
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {RUBRIC_FIELD.hint}
                  </p>
                </div>
              ) : null}
            </div>
          </StepperContent>

          <StepperContent value={4}>
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Name</span>
                  <span className="text-sm font-medium">
                    {draft.name || 'Untitled tournament'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Mode</span>
                  <span className="text-sm font-medium">
                    {modes.find((mode) => mode.enum === draft.gameMode)
                      ?.label ?? draft.gameMode}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Visibility
                  </span>
                  <span className="text-sm font-medium">
                    {draft.visibility}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Languages
                  </span>
                  <span className="text-sm font-medium">
                    {draft.languageIds.length} enabled
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Team size
                  </span>
                  <span className="text-sm font-medium">
                    {draft.teamSizeMin} to {draft.teamSizeMax}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Window</span>
                  <span className="text-sm font-medium">
                    {new Date(draft.startsAt).toLocaleString()} →{' '}
                    {new Date(draft.endsAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Could not create the tournament</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          </StepperContent>
        </StepperPanel>

        <div className="flex items-center justify-between gap-2.5">
          <Button
            variant="outline"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setStep((current) => Math.min(STEPS.length, current + 1))
            }
            disabled={step === STEPS.length}
          >
            Next
          </Button>
          <Button onClick={submit} disabled={saving || !draft.name.trim()}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />}
            Create tournament
          </Button>
        </div>
      </Stepper>
    </div>
  )
}

export async function loadLanguages(): Promise<LanguageOption[]> {
  return listAvailableLanguages()
}
