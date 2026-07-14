'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/style.css';
import { useCreateTastingSession, useAddRecipesToSession } from '@/lib/hooks/useTastings';
import { useSendTastingInvitation } from '@/lib/hooks/useSendTastingInvitation';
import { PageHeader, Button, Input, Textarea } from '@/components/ui';
import { ParticipantPicker } from '@/components/tasting/ParticipantPicker';
import type { User } from '@/types';

export default function NewTastingSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRecipeIds = (searchParams.get('recipe_ids') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => n > 0);
  const createSession = useCreateTastingSession();
  const addRecipesToSession = useAddRecipesToSession();
  const sendInvitation = useSendTastingInvitation();

  const [name, setName] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState('10');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');
  const [showCalendar, setShowCalendar] = useState(false);
  const [location, setLocation] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<User[]>([]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ name?: string; date?: string }>({});

  const hours = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
  const minutes = ['00', '15', '30', '45'];

  const get24HourTime = (): string => {
    let hour = parseInt(selectedHour);
    if (selectedPeriod === 'AM') {
      if (hour === 12) hour = 0;
    } else {
      if (hour !== 12) hour += 12;
    }
    return `${hour.toString().padStart(2, '0')}:${selectedMinute}`;
  };

  const getDisplayTime = (): string => {
    return `${selectedHour}:${selectedMinute} ${selectedPeriod}`;
  };

  const getDateTimeString = (): string => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const offset = selectedDate.getTimezoneOffset();
    const sign = offset <= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const offsetHours = Math.floor(absOffset / 60).toString().padStart(2, '0');
    const offsetMins = (absOffset % 60).toString().padStart(2, '0');
    return `${dateStr}T${get24HourTime()}:00${sign}${offsetHours}:${offsetMins}`;
  };

  const validateForm = (): boolean => {
    const newErrors: { name?: string; date?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Session name is required';
    }

    if (!selectedDate) {
      newErrors.date = 'Please select a date and time';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const participantIds = selectedParticipants.map((p) => p.id);
      const session = await createSession.mutateAsync({
        name: name.trim(),
        date: getDateTimeString(),
        location: location.trim() || null,
        participant_ids: participantIds.length > 0 ? participantIds : null,
        notes: notes.trim() || null,
      });

      // Add pre-selected recipes from menu sketch
      if (preselectedRecipeIds.length > 0) {
        await addRecipesToSession.mutateAsync({
          sessionId: session.id,
          data: { recipe_ids: preselectedRecipeIds },
        });
      }

      // Send email/SMS invitations if there are participants
      if (selectedParticipants.length > 0) {
        sendInvitation.mutate({
          session_id: session.id,
          session_name: name.trim(),
          session_date: getDateTimeString(),
          formatted_date: `${format(selectedDate, 'EEEE, MMMM d, yyyy')} at ${getDisplayTime()}`,
          session_location: location.trim() || null,
          recipients: selectedParticipants.map((p) => ({
            email: p.email,
            username: p.username,
            phone_number: p.phone_number ?? null,
          })),
        });
      }

      router.push(`/tastings/${session.id}`);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/rnd"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to R&D
          </Link>
        </div>

        <PageHeader
          title="New tasting session"
          description="Create a new session to track recipe tastings and feedback"
        />

        {preselectedRecipeIds.length > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">
            <FlaskConical className="h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="font-medium">{preselectedRecipeIds.length} dish{preselectedRecipeIds.length !== 1 ? 'es' : ''}</span>
              {' '}from your menu draft will be added to this session.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-muted-foreground mb-1"
            >
              Session name *
            </label>
            <Input
              id="name"
              placeholder="e.g., December menu tasting"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              className={errors.name ? 'border-[var(--color-feedback-error)]' : ''}
            />
            {errors.name && <p className="text-xs text-[var(--color-feedback-error)] mt-1">{errors.name}</p>}
          </div>

          <div>
            <label
              htmlFor="date"
              className="block text-sm font-medium text-muted-foreground mb-1"
            >
              Date & time *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg bg-card text-left text-sm hover:border-input transition-colors ${
                  errors.date ? 'border-[var(--color-feedback-error)]' : 'border-input'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {format(selectedDate, 'MMMM d, yyyy')}
                  <span className="text-muted-foreground">|</span>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {getDisplayTime()}
                </span>
              </button>
              {showCalendar && (
                <div className="absolute z-10 mt-1 bg-popover border border-border rounded-xl shadow-elevation-2 p-3">
                  <style>{`
                    .rdp-root {
                      --rdp-accent-color: var(--color-brand-accent);
                      --rdp-accent-background-color: var(--surface-selected);
                    }
                  `}</style>
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
                      }
                    }}

                  />
                  <div className="border-t border-border mt-3 pt-3">
                    <label className="block text-xs font-medium text-muted-foreground mb-2">
                      Select time
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedHour}
                        onChange={(e) => setSelectedHour(e.target.value)}
                        className="flex-1 px-3 py-2 border border-input rounded-lg bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        {hours.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <span className="text-muted-foreground font-medium">:</span>
                      <select
                        value={selectedMinute}
                        onChange={(e) => setSelectedMinute(e.target.value)}
                        className="flex-1 px-3 py-2 border border-input rounded-lg bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        {minutes.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value as 'AM' | 'PM')}
                        className="flex-1 px-3 py-2 border border-input rounded-lg bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCalendar(false)}
                    className="w-full mt-3 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
            {errors.date && <p className="text-xs text-[var(--color-feedback-error)] mt-1">{errors.date}</p>}
          </div>

          <div>
            <label
              htmlFor="location"
              className="block text-sm font-medium text-muted-foreground mb-1"
            >
              Location
            </label>
            <Input
              id="location"
              placeholder="e.g., Main kitchen"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Attendees
            </label>
            <ParticipantPicker
              selectedUsers={selectedParticipants}
              onChange={setSelectedParticipants}
            />
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-muted-foreground mb-1"
            >
              Session notes
            </label>
            <Textarea
              id="notes"
              placeholder="Any general notes about this tasting session..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button type="submit" disabled={createSession.isPending}>
              {createSession.isPending ? 'Creating...' : 'Create session'}
            </Button>
            <Link href="/rnd">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
