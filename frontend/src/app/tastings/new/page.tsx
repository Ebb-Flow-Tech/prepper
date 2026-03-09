'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/style.css';
import { useCreateTastingSession } from '@/lib/hooks/useTastings';
import { useSendTastingInvitation } from '@/lib/hooks/useSendTastingInvitation';
import { PageHeader, Button, Input, Textarea } from '@/components/ui';
import { ParticipantPicker } from '@/components/tasting/ParticipantPicker';
import type { User } from '@/types';

export default function NewTastingSessionPage() {
  const router = useRouter();
  const createSession = useCreateTastingSession();
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
            href="/tastings"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tasting Sessions
          </Link>
        </div>

        <PageHeader
          title="New Tasting Session"
          description="Create a new session to track recipe tastings and feedback"
        />

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Session Name *
            </label>
            <Input
              id="name"
              placeholder="e.g., December Menu Tasting"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label
              htmlFor="date"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Date & Time *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className={`w-full flex items-center justify-between px-3 py-2 border rounded-md bg-white dark:bg-zinc-900 text-left text-sm hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors ${
                  errors.date ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  {format(selectedDate, 'MMMM d, yyyy')}
                  <span className="text-zinc-400">|</span>
                  <Clock className="h-4 w-4 text-zinc-500" />
                  {getDisplayTime()}
                </span>
              </button>
              {showCalendar && (
                <div className="absolute z-10 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-3">
                  <style>{`
                    .rdp-root {
                      --rdp-accent-color: hsl(15 65% 50%);
                      --rdp-accent-background-color: hsl(15 65% 95%);
                    }
                    .dark .rdp-root {
                      --rdp-accent-color: hsl(15 65% 60%);
                      --rdp-accent-background-color: hsl(15 65% 15%);
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
                  <div className="border-t border-zinc-200 dark:border-zinc-700 mt-3 pt-3">
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                      Select Time
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedHour}
                        onChange={(e) => setSelectedHour(e.target.value)}
                        className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(15_65%_50%)] focus:border-transparent"
                      >
                        {hours.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <span className="text-zinc-500 font-medium">:</span>
                      <select
                        value={selectedMinute}
                        onChange={(e) => setSelectedMinute(e.target.value)}
                        className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(15_65%_50%)] focus:border-transparent"
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
                        className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(15_65%_50%)] focus:border-transparent"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCalendar(false)}
                    className="w-full mt-3 px-3 py-2 bg-[hsl(15_65%_50%)] hover:bg-[hsl(15_65%_45%)] text-white rounded-md text-sm font-medium transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
            {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
          </div>

          <div>
            <label
              htmlFor="location"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Location
            </label>
            <Input
              id="location"
              placeholder="e.g., Main Kitchen"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
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
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Session Notes
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
              {createSession.isPending ? 'Creating...' : 'Create Session'}
            </Button>
            <Link href="/tastings">
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
