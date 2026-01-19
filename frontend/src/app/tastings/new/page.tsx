'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, X } from 'lucide-react';
import Link from 'next/link';
import { DayPicker } from 'react-day-picker';
import { format, startOfDay } from 'date-fns';
import 'react-day-picker/style.css';
import { useCreateTastingSession } from '@/lib/hooks/useTastings';
import { PageHeader, Button, Input, Textarea, Badge } from '@/components/ui';

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default function NewTastingSessionPage() {
  const router = useRouter();
  const createSession = useCreateTastingSession();

  const [name, setName] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState('10');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');
  const [showCalendar, setShowCalendar] = useState(false);
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ name?: string; date?: string; attendees?: string }>({});
  const emailInputRef = useRef<HTMLInputElement>(null);

  const today = startOfDay(new Date());

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

  const getSelectedDateTime = (): Date => {
    const timeStr = get24HourTime();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const dateTime = new Date(selectedDate);
    dateTime.setHours(hours, minutes, 0, 0);
    return dateTime;
  };

  const getDateTimeString = (): string => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return `${dateStr}T${get24HourTime()}`;
  };

  const handleEmailInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (value.endsWith(' ') && value.trim()) {
      const email = value.trim();
      if (email && !attendees.includes(email)) {
        setAttendees([...attendees, email]);
      }
      setCurrentEmail('');
    } else {
      setCurrentEmail(value);
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const email = currentEmail.trim();
      if (email && !attendees.includes(email)) {
        setAttendees([...attendees, email]);
      }
      setCurrentEmail('');
    } else if (e.key === 'Backspace' && !currentEmail && attendees.length > 0) {
      setAttendees(attendees.slice(0, -1));
    }
  };

  const removeAttendee = (emailToRemove: string) => {
    setAttendees(attendees.filter((email) => email !== emailToRemove));
  };

  const validateForm = (): boolean => {
    const newErrors: { name?: string; date?: string; attendees?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Session name is required';
    }

    if (!selectedDate) {
      newErrors.date = 'Please select a date and time';
    } else {
      const selectedDateTime = getSelectedDateTime();
      const now = new Date();
      if (selectedDateTime < now) {
        newErrors.date = 'Date and time cannot be in the past';
      }
    }

    if (attendees.length > 0) {
      const invalidEmails = attendees.filter((email) => !isValidEmail(email));
      if (invalidEmails.length > 0) {
        newErrors.attendees = `Invalid email${invalidEmails.length > 1 ? 's' : ''}: ${invalidEmails.join(', ')}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const session = await createSession.mutateAsync({
        name: name.trim(),
        date: getDateTimeString(),
        location: location.trim() || null,
        attendees: attendees.length > 0 ? attendees : null,
        notes: notes.trim() || null,
      });

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
                    disabled={{ before: today }}
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
            <label
              htmlFor="attendees"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Attendees
            </label>
            <div
              className={`flex flex-wrap items-center gap-2 p-2 border rounded-md bg-white dark:bg-zinc-900 min-h-[42px] cursor-text ${
                errors.attendees ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'
              }`}
              onClick={() => emailInputRef.current?.focus()}
            >
              {attendees.map((email) => (
                <Badge
                  key={email}
                  variant={isValidEmail(email) ? 'default' : 'destructive'}
                  className="flex items-center gap-1 pr-1"
                >
                  {email}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAttendee(email);
                      if (errors.attendees) setErrors((prev) => ({ ...prev, attendees: undefined }));
                    }}
                    className="ml-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <input
                ref={emailInputRef}
                id="attendees"
                type="text"
                placeholder={attendees.length === 0 ? 'Enter email addresses...' : ''}
                value={currentEmail}
                onChange={handleEmailInput}
                onKeyDown={handleEmailKeyDown}
                className="flex-1 min-w-[150px] bg-transparent border-none outline-none text-sm placeholder:text-zinc-400"
              />
            </div>
            {errors.attendees ? (
              <p className="text-xs text-red-500 mt-1">{errors.attendees}</p>
            ) : (
              <p className="text-xs text-zinc-500 mt-1">
                Press space or enter to add an email. Invalid emails appear in red.
              </p>
            )}
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
