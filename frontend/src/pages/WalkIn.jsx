import { waitForMockResponse as mockDelay } from '../data/mockLatency.js';
import { notifyError } from '../components/Notifications.jsx';
import { useEffect, useRef, useState } from 'react';
import { Button, Field, PageHeading } from '../components/ui.jsx';
import { usePersistedState } from '../hooks/usePersistedState.js';
import { initialStudents } from './StaffInventory.jsx';
import './walk-in.css';

// Simulate request latency until the student and pickup APIs are connected.


export default function WalkIn({ navigate, notify }) {
  const [studentId, setStudentId] = useState('');
  const [searchedId, setSearchedId] = useState('');
  const [fullName, setFullName] = useState('');
  const [idChecked, setIdChecked] = useState(false);
  const [match, setMatch] = useState(null);
  const [searchState, setSearchState] = useState('idle');
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = usePersistedState('panther-students-v1', initialStudents);
  const studentsRef = useRef(students);
  const operation = useRef(0);
  const busy = useRef(false);
  studentsRef.current = students;
  const hasResult = searchState === 'found' || searchState === 'not-found';

  // Ignore pending mock responses after navigating away.
  useEffect(() => () => { operation.current += 1; }, []);

  function resetSearch(value) {
    operation.current += 1;
    setStudentId(value);
    setSearchedId('');
    setSearchState('idle');
    setMatch(null);
    setFullName('');
    setIdChecked(false);


  }

  async function findStudent(event) {
    event.preventDefault();
    if (busy.current) return;
    const nextId = studentId.trim().toUpperCase();
    if (!/^P\d{8}$/.test(nextId)) {
      notifyError('Enter a student ID beginning with P followed by eight numbers.');
      return;
    }
    const token = ++operation.current;
    busy.current = true;
    setStudentId(nextId);
    setSearchState('searching');


    setMatch(null);
    setFullName('');
    setIdChecked(false);
    try {
      await mockDelay(650);
      if (token !== operation.current) return;
      const existing = studentsRef.current.find(student => student.id.toUpperCase() === nextId);
      setSearchedId(nextId);
      setMatch(existing || null);
      setFullName(existing?.name || '');
      setSearchState(existing ? 'found' : 'not-found');
    } catch {
      if (token !== operation.current) return;
      setSearchState('idle');
      notifyError('The search could not be completed. Please try again.');
    } finally {
      if (token === operation.current) busy.current = false;
    }
  }

  async function handOutFood(event) {
    event.preventDefault();
    if (busy.current) return;
    if (!hasResult || studentId.trim().toUpperCase() !== searchedId) {
      notifyError('Search for this student ID before continuing.');
      return;
    }
    if (!fullName.trim()) { notifyError('Enter the student’s full name.'); return; }
    if (!idChecked) { notifyError('Check the student’s ID card before continuing.'); return; }
    const token = ++operation.current;
    busy.current = true;
    setSaving(true);

    try {
      await mockDelay(match ? 400 : 850);
      if (token !== operation.current) return;
      // Recheck after the simulated request to avoid duplicate profiles.
      const existing = studentsRef.current.find(student => student.id.toUpperCase() === searchedId);
      const now = new Date();
      const checked = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });
      const student = existing || { name: fullName.trim(), id: searchedId, provisional: true, checked, lastPickup: '—', request: '' };
      const pickup = {
        id: `walk-in-${crypto.randomUUID()}`,
        name: student.name,
        studentId: searchedId,
        time: 'Walk-in',
        date: now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }),
        fullPickupDate: now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric' }),
        note: '', firstVisit: !existing || student.lastPickup === '—', idChecked: true, status: 'Approved',
      };
      localStorage.setItem('panther-active-pickup', JSON.stringify(pickup));
      setStudents(current => current.some(entry => entry.id.toUpperCase() === searchedId)
        ? current.map(entry => entry.id.toUpperCase() === searchedId ? { ...entry, checked } : entry)
        : [...current, student]);
      notify?.(existing ? 'Student ready for a walk-in pickup.' : 'Provisional profile created. Add items to this pickup.');
      navigate('/staff/distribution');
    } catch {
      if (token === operation.current) notifyError('Your browser could not save this pickup. Enable local storage and try again.');
    } finally {
      if (token === operation.current) { busy.current = false; setSaving(false); }
    }
  }

  return <div className="walk-in-page">
    <PageHeading title="Walk-in" description="For a student who arrives without a request." />
    <section className="walk-in-card" aria-labelledby="walk-in-find-title">
      <h2 id="walk-in-find-title">1. Find the student</h2>
      <form className="walk-in-search" onSubmit={findStudent} aria-busy={searchState === 'searching'}>
        <Field label="Student ID number"><input className="input" aria-label="Student ID number to search" value={studentId} onChange={event => resetSearch(event.target.value)} placeholder="Enter student ID" autoComplete="off" maxLength={9} disabled={searchState === 'searching' || saving} required /></Field>
        <Button type="submit" loading={searchState === 'searching'} disabled={saving}>{searchState === 'searching' ? 'Searching…' : 'Search'}</Button>
      </form>

      {searchState === 'searching' && <p className="walk-in-helper" role="status">Searching student records…</p>}
      {hasResult && <div className={`walk-in-status ${match ? 'walk-in-status-found' : ''}`} role="status"><img src="/assets/figma/walk-in-info.svg" alt="" /><p>{match ? <><strong>{match.name} found.</strong> Confirm their ID card below to start a walk-in pickup.</> : <><strong>No student found with ID {searchedId}.</strong> Create a provisional profile below so the food handed out is still recorded.</>}</p></div>}
    </section>

    {hasResult && <>
      <form className="walk-in-card walk-in-profile" onSubmit={handOutFood} aria-labelledby="walk-in-profile-title" aria-busy={saving}>
        <h2 id="walk-in-profile-title">{match ? '2. Confirm the student' : '2. Create a provisional profile'}</h2>
        <div className="walk-in-profile-fields">
          <Field label="Full name"><input className="input" name="fullName" value={fullName} readOnly={!!match} disabled={saving} onChange={event => { setFullName(event.target.value); }} required /></Field>
          <Field label="Student ID number"><input className="input" value={searchedId} disabled aria-label="Selected student ID number" /></Field>
        </div>
        <label className="walk-in-check"><input type="checkbox" checked={idChecked} disabled={saving} onChange={event => { setIdChecked(event.target.checked); }} /><span>I checked the student's ID card</span></label>
        <p className="walk-in-helper">{match ? 'This pickup will be recorded on the student’s existing profile.' : 'If the student signs up later with this student ID, their pickups move to the new account.'}</p>

        <Button type="submit" loading={saving}>{saving ? match ? 'Opening pickup…' : 'Creating profile…' : match ? 'Hand out food' : 'Create profile and hand out food'}</Button>
        {saving && <p className="walk-in-helper" role="status">{match ? 'Preparing the pickup…' : 'Creating the student’s provisional profile…'}</p>}
      </form>
    </>}
  </div>;
}
