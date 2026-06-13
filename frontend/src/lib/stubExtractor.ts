/**
 * Client-side stub extractor.
 * No backend needed. Returns realistic Indian campus data based on filename keywords.
 *
 * Routing rules (checked in order):
 *   "timetable" | "schedule" | "class"       → timetable (full week schedule)
 *   "menu" | "mess" | "food"                  → mess menu (breakfast/lunch/snacks/dinner)
 *   "placement" | "amazon" | "tcs" | "drive"  → placement update
 *   "water" | "hostel" | "maintenance"        → hostel notice
 *   "event" | "hackathon" | "fest" | "club"   → club event
 *   "assignment" | "deadline" | "homework"    → deadline/assignment
 *   fallback                                  → mixed (a bit of everything)
 *
 * Each result has 1-2 fields with confidence < 0.6 to trigger "Confirm" UI.
 */

export interface ExtractionResult {
  document_type: string
  classes: Array<{
    day: string; time: string; subject: string;
    location?: string; professor?: string; confidence: number
  }>
  deadlines: Array<{
    id: string; title: string; subject: string;
    due_date: string; description?: string; confidence: number
  }>
  notices: Array<{
    id: string; title: string; body: string;
    date?: string; category: string; confidence: number
  }>
  menu_items: Array<{
    meal: string; day: string; items: string[]; confidence: number
  }>
  events: Array<{
    id: string; name: string; datetime: string; venue: string;
    club: string; description?: string; confidence: number
  }>
  placements: Array<{
    id: string; company: string; role: string; ctc: string;
    cgpa_cutoff: string; registration_deadline: string;
    test_date: string; confidence: number
  }>
  overall_confidence: number
  source_file: string
  raw_text: string
}

export async function stubExtract(file: File): Promise<ExtractionResult> {
  // Simulate network delay (400-900ms)
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 500))

  const fname = file.name.toLowerCase()

  // Order matters: more specific keywords first
  if (fname.match(/timetable|schedule|class/)) {
    return stubTimetable(file.name)
  }
  if (fname.match(/placement|amazon|tcs|drive|recruit/)) {
    return stubPlacement(file.name)
  }
  if (fname.match(/water|hostel|maintenance|disruption/)) {
    return stubHostelNotice(file.name)
  }
  if (fname.match(/event|hackathon|fest|club|codestorm/)) {
    return stubEvent(file.name)
  }
  if (fname.match(/menu|mess|food|canteen/)) {
    return stubMenu(file.name)
  }
  if (fname.match(/assignment|deadline|homework|submit/)) {
    return stubDeadline(file.name)
  }
  if (fname.match(/notice|circular/)) {
    // Generic notice — could be anything; return a mix of hostel + academic
    return stubGenericNotice(file.name)
  }
  return stubMixed(file.name)
}

// ─── TIMETABLE ──────────────────────────────────────────────────────────────────

function stubTimetable(filename: string): ExtractionResult {
  return {
    document_type: 'timetable',
    classes: [
      { day: 'Monday', time: '09:00', subject: 'Data Structures & Algorithms', location: 'LH-301', professor: 'Dr. R.K. Sharma', confidence: 0.95 },
      { day: 'Monday', time: '11:00', subject: 'Database Management Systems', location: 'LH-204', professor: 'Prof. A. Gupta', confidence: 0.93 },
      { day: 'Monday', time: '14:00', subject: 'DSA Lab', location: 'CC-Lab 2', professor: 'Dr. R.K. Sharma', confidence: 0.55 },
      { day: 'Tuesday', time: '09:00', subject: 'Mathematics III', location: 'LH-301', professor: 'Dr. S. Verma', confidence: 0.96 },
      { day: 'Tuesday', time: '11:00', subject: 'Computer Networks', location: 'LH-205', professor: 'Prof. M. Singh', confidence: 0.91 },
      { day: 'Tuesday', time: '14:00', subject: 'DBMS Lab', location: 'CC-Lab 3', professor: 'Prof. A. Gupta', confidence: 0.88 },
      { day: 'Wednesday', time: '09:00', subject: 'Data Structures & Algorithms', location: 'LH-301', professor: 'Dr. R.K. Sharma', confidence: 0.95 },
      { day: 'Wednesday', time: '11:00', subject: 'Digital Electronics', location: 'LH-204', professor: 'Prof. P. Rao', confidence: 0.89 },
      { day: 'Wednesday', time: '14:00', subject: 'Computer Networks Lab', location: 'CC-Lab 3', professor: 'Prof. M. Singh', confidence: 0.47 },
      { day: 'Thursday', time: '09:00', subject: 'Mathematics III', location: 'LH-301', professor: 'Dr. S. Verma', confidence: 0.94 },
      { day: 'Thursday', time: '11:00', subject: 'Database Management Systems', location: 'LH-204', professor: 'Prof. A. Gupta', confidence: 0.92 },
      { day: 'Thursday', time: '14:00', subject: 'Soft Skills & Communication', location: 'LH-102', professor: 'Ms. P. Reddy', confidence: 0.90 },
      { day: 'Friday', time: '09:00', subject: 'Data Structures & Algorithms', location: 'LH-301', professor: 'Dr. R.K. Sharma', confidence: 0.95 },
      { day: 'Friday', time: '11:00', subject: 'Computer Networks', location: 'LH-205', professor: 'Prof. M. Singh', confidence: 0.91 },
      { day: 'Friday', time: '14:00', subject: 'Mini Project', location: 'CC-Lab 1', professor: 'Dr. R.K. Sharma', confidence: 0.58 },
    ],
    deadlines: [],
    notices: [],
    menu_items: [],
    events: [],
    placements: [],
    overall_confidence: 0.91,
    source_file: filename,
    raw_text: 'B.Tech CSE Sem-3 Timetable — Section A — NIT Bhopal',
  }
}

// ─── MESS MENU ──────────────────────────────────────────────────────────────────

function stubMenu(filename: string): ExtractionResult {
  return {
    document_type: 'menu',
    classes: [],
    deadlines: [],
    notices: [],
    events: [],
    placements: [],
    menu_items: [
      { meal: 'breakfast', day: 'Monday', items: ['Aloo Paratha (2)', 'Curd', 'Pickle', 'Tea/Coffee', 'Banana'], confidence: 0.94 },
      { meal: 'lunch', day: 'Monday', items: ['Rice', 'Dal Tadka', 'Aloo Gobi', 'Roti (4)', 'Green Salad', 'Curd'], confidence: 0.91 },
      { meal: 'snacks', day: 'Monday', items: ['Samosa (2)', 'Chai'], confidence: 0.53 },
      { meal: 'dinner', day: 'Monday', items: ['Jeera Rice', 'Rajma Masala', 'Paneer Butter Masala', 'Roti (4)', 'Gulab Jamun'], confidence: 0.92 },
      { meal: 'breakfast', day: 'Tuesday', items: ['Idli (4)', 'Sambar', 'Coconut Chutney', 'Coffee', 'Apple'], confidence: 0.93 },
      { meal: 'lunch', day: 'Tuesday', items: ['Rice', 'Sambar', 'Bhindi Fry', 'Roti (4)', 'Papad', 'Buttermilk'], confidence: 0.90 },
      { meal: 'snacks', day: 'Tuesday', items: ['Bread Pakora', 'Tea'], confidence: 0.88 },
      { meal: 'dinner', day: 'Tuesday', items: ['Veg Biryani', 'Raita', 'Mixed Veg Curry', 'Roti (4)', 'Ice Cream'], confidence: 0.91 },
      { meal: 'breakfast', day: 'Wednesday', items: ['Poha', 'Jalebi (2)', 'Bread-Butter-Jam', 'Tea/Coffee'], confidence: 0.92 },
      { meal: 'lunch', day: 'Wednesday', items: ['Rice', 'Chana Dal', 'Baingan Bharta', 'Roti (4)', 'Salad', 'Lassi'], confidence: 0.89 },
      { meal: 'snacks', day: 'Wednesday', items: ['Vada Pav', 'Chai'], confidence: 0.55 },
      { meal: 'dinner', day: 'Wednesday', items: ['Rice', 'Kadhi Pakora', 'Aloo Matar', 'Roti (4)', 'Kheer'], confidence: 0.90 },
      { meal: 'breakfast', day: 'Thursday', items: ['Chole Bhature (2)', 'Lassi', 'Banana'], confidence: 0.93 },
      { meal: 'lunch', day: 'Thursday', items: ['Rice', 'Moong Dal', 'Gobi Matar', 'Roti (4)', 'Pickle', 'Curd'], confidence: 0.91 },
      { meal: 'snacks', day: 'Thursday', items: ['Dhokla', 'Green Chutney', 'Tea'], confidence: 0.87 },
      { meal: 'dinner', day: 'Thursday', items: ['Chicken Biryani / Veg Pulao', 'Raita', 'Dal Fry', 'Roti (4)', 'Jalebi'], confidence: 0.92 },
      { meal: 'breakfast', day: 'Friday', items: ['Upma', 'Bread-Omelette / Bread-Butter', 'Tea/Coffee', 'Orange'], confidence: 0.90 },
      { meal: 'lunch', day: 'Friday', items: ['Rice', 'Arhar Dal', 'Palak Paneer', 'Roti (4)', 'Salad', 'Chaas'], confidence: 0.89 },
      { meal: 'snacks', day: 'Friday', items: ['Maggi', 'Chai'], confidence: 0.86 },
      { meal: 'dinner', day: 'Friday', items: ['Fried Rice', 'Manchurian', 'Dal Makhani', 'Roti (4)', 'Fruit Custard'], confidence: 0.91 },
      { meal: 'breakfast', day: 'Saturday', items: ['Dosa (2)', 'Sambar', 'Chutney', 'Coffee', 'Banana'], confidence: 0.93 },
      { meal: 'lunch', day: 'Saturday', items: ['Rice', 'Dal Makhani', 'Seasonal Sabzi', 'Roti (4)', 'Sweet Lassi'], confidence: 0.88 },
      { meal: 'dinner', day: 'Saturday', items: ['Pav Bhaji', 'Pulao', 'Raita', 'Rasmalai'], confidence: 0.90 },
      { meal: 'breakfast', day: 'Sunday', items: ['Puri (4)', 'Aloo Sabzi', 'Tea/Coffee', 'Apple'], confidence: 0.92 },
      { meal: 'lunch', day: 'Sunday', items: ['Rice', 'Rajma', 'Matar Paneer', 'Roti (4)', 'Gulab Jamun', 'Buttermilk'], confidence: 0.91 },
      { meal: 'dinner', day: 'Sunday', items: ['Egg Curry / Soya Chunks', 'Rice', 'Dal Fry', 'Roti (4)', 'Ice Cream'], confidence: 0.89 },
    ],
    overall_confidence: 0.90,
    source_file: filename,
    raw_text: 'Boys Hostel Block-C Mess Menu — Week of Oct 7–13, 2024',
  }
}

// ─── PLACEMENT UPDATE ───────────────────────────────────────────────────────────

function stubPlacement(filename: string): ExtractionResult {
  return {
    document_type: 'placement',
    classes: [],
    deadlines: [],
    menu_items: [],
    events: [],
    notices: [
      {
        id: 'placement-amazon-2024',
        title: 'Amazon SDE Internship — Campus Placement Drive',
        body: 'Amazon is hiring SDE Interns for Summer 2025. Role: SDE Intern. CTC: ₹1,20,000/month stipend. Eligibility: CSE/IT/ECE, 7.5+ CGPA, no active backlogs. Online test on 25th October 2024 (HackerRank). Register on placement portal by 20th October. Carry laptop for coding round.',
        date: '2024-10-10',
        category: 'placement',
        confidence: 0.95,
      },
    ],
    placements: [
      {
        id: 'amazon-sde-intern-2024',
        company: 'Amazon',
        role: 'SDE Intern (Summer 2025)',
        ctc: '₹1,20,000/month stipend',
        cgpa_cutoff: '7.5',
        registration_deadline: '2024-10-20',
        test_date: '2024-10-25',
        confidence: 0.94,
      },
      {
        id: 'amazon-sde-fte-2024',
        company: 'Amazon',
        role: 'SDE-1 (Full-Time)',
        ctc: '₹32 LPA (base + stocks)',
        cgpa_cutoff: '7.5',
        registration_deadline: '2024-10-20',
        test_date: '2024-10-25',
        confidence: 0.53,
      },
    ],
    overall_confidence: 0.91,
    source_file: filename,
    raw_text: 'Training & Placement Cell — Amazon Campus Drive 2024',
  }
}

// ─── HOSTEL NOTICE ──────────────────────────────────────────────────────────────

function stubHostelNotice(filename: string): ExtractionResult {
  return {
    document_type: 'hostel_notice',
    classes: [],
    deadlines: [],
    menu_items: [],
    events: [],
    placements: [],
    notices: [
      {
        id: 'hostel-water-oct8',
        title: 'Water Supply Disruption — Block C',
        body: 'Due to overhead tank cleaning and pipeline maintenance, water supply in Boys Hostel Block C will be disrupted on 12th October from 9:00 AM to 5:00 PM. Please store water in advance. Emergency tanker available near gate.',
        date: '2024-10-10',
        category: 'hostel',
        confidence: 0.93,
      },
      {
        id: 'hostel-wifi-maintenance',
        title: 'WiFi Maintenance — All Blocks',
        body: 'LAN and WiFi services will undergo scheduled maintenance on 13th October, 2 AM to 6 AM. Please plan downloads accordingly.',
        date: '2024-10-10',
        category: 'hostel',
        confidence: 0.49,
      },
    ],
    overall_confidence: 0.88,
    source_file: filename,
    raw_text: 'Hostel Warden Office — Boys Hostel Block C',
  }
}

// ─── CLUB EVENT / HACKATHON ─────────────────────────────────────────────────────

function stubEvent(filename: string): ExtractionResult {
  return {
    document_type: 'event',
    classes: [],
    deadlines: [],
    menu_items: [],
    placements: [],
    notices: [
      {
        id: 'event-codestorm-2024',
        title: 'CodeStorm 2024 — 36-Hour Inter-College Hackathon',
        body: 'CSE department presents CodeStorm 2024. Team size: 3-4. Themes: HealthTech, EdTech, FinTech, Sustainability. Prizes worth ₹50,000. Registration: ₹200/team. Dates: 25-26 October. Venue: Innovation Lab, 2nd Floor.',
        date: '2024-10-07',
        category: 'event',
        confidence: 0.93,
      },
    ],
    events: [
      {
        id: 'codestorm-2024',
        name: 'CodeStorm 2024 — 36hr Hackathon',
        datetime: '2024-10-25T09:00:00',
        venue: 'Innovation Lab, 2nd Floor, CS Block',
        club: 'CSE Department / Coding Club',
        description: 'Inter-college hackathon. Themes: HealthTech, EdTech, FinTech, Sustainability. Team of 3-4. Prizes ₹50,000. Registration ₹200/team at codestorm.nitb.ac.in by 20 Oct.',
        confidence: 0.92,
      },
      {
        id: 'techtalks-ai-oct',
        name: 'TechTalks: Generative AI in Production',
        datetime: '2024-10-18T16:00:00',
        venue: 'Seminar Hall, Admin Block',
        club: 'AI/ML Club',
        description: 'Guest lecture by Dr. Ankit Jain (Google Research). Open to all branches. No registration needed.',
        confidence: 0.56,
      },
    ],
    overall_confidence: 0.89,
    source_file: filename,
    raw_text: 'Coding Club × CSE Department — Event Poster',
  }
}

// ─── DEADLINE / ASSIGNMENT ──────────────────────────────────────────────────────

function stubDeadline(filename: string): ExtractionResult {
  // Use a due date that is ~9 hours from "now" for the demo effect
  const now = new Date()
  const dueDate = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const dueDateStr = dueDate.toISOString().split('T')[0]
  const dueTimeStr = dueDate.toTimeString().slice(0, 5)

  return {
    document_type: 'deadline',
    classes: [],
    notices: [],
    menu_items: [],
    events: [],
    placements: [],
    deadlines: [
      {
        id: 'hw-dbms-er',
        title: 'DBMS Assignment 4 — ER Diagram & Normalization',
        subject: 'Database Management Systems',
        due_date: dueDateStr,
        description: `Design ER diagram for Library Management System. Normalize to 3NF. Submit PDF on Moodle by ${dueTimeStr} today. Late penalty: -25% per day.`,
        confidence: 0.94,
      },
      {
        id: 'hw-dsa-trees',
        title: 'DSA Assignment 3 — AVL Trees',
        subject: 'Data Structures & Algorithms',
        due_date: '2024-10-15',
        description: 'Implement AVL tree with insertion, deletion. Submit code + complexity analysis on Moodle.',
        confidence: 0.91,
      },
      {
        id: 'hw-cn-socket',
        title: 'CN Lab Report — Socket Programming',
        subject: 'Computer Networks',
        due_date: '2024-10-17',
        description: 'TCP client-server chat application. Submit code + screenshots.',
        confidence: 0.54,
      },
    ],
    overall_confidence: 0.88,
    source_file: filename,
    raw_text: 'Assignment Deadlines — B.Tech CSE Sem-3',
  }
}

// ─── GENERIC NOTICE (fallback for "notice" keyword without hostel/placement) ────

function stubGenericNotice(filename: string): ExtractionResult {
  return {
    document_type: 'notice',
    classes: [],
    deadlines: [],
    menu_items: [],
    events: [],
    placements: [],
    notices: [
      {
        id: 'notice-midsem-2024',
        title: 'Mid-Semester Examination Schedule',
        body: 'Mid-semester examinations for B.Tech Sem-3: 15th–22nd October 2024. Carry ID card. No electronic devices. Seating arrangement on dept notice board 2 days prior.',
        date: '2024-10-05',
        category: 'academic',
        confidence: 0.94,
      },
      {
        id: 'notice-library-hours',
        title: 'Extended Library Hours — Exam Period',
        body: 'Central Library open 7 AM to 11 PM during exams (15–22 Oct). Group study rooms bookable at counter.',
        date: '2024-10-09',
        category: 'academic',
        confidence: 0.57,
      },
    ],
    overall_confidence: 0.90,
    source_file: filename,
    raw_text: 'Department of CSE — Official Circular',
  }
}

// ─── MIXED (last resort) ────────────────────────────────────────────────────────

function stubMixed(filename: string): ExtractionResult {
  return {
    document_type: 'mixed',
    classes: [
      { day: 'Monday', time: '09:00', subject: 'Data Structures & Algorithms', location: 'LH-301', professor: 'Dr. Sharma', confidence: 0.85 },
    ],
    deadlines: [
      { id: 'hw-dbms-er', title: 'DBMS Assignment 4 — ER Diagram', subject: 'DBMS', due_date: new Date(Date.now() + 9 * 3600000).toISOString().split('T')[0], confidence: 0.82 },
    ],
    notices: [
      { id: 'notice-placement-amazon', title: 'Amazon SDE Internship Drive', body: 'Amazon hiring SDE Interns. Test on 25 Oct. Register by 20 Oct. CGPA 7.5+.', date: '2024-10-10', category: 'placement', confidence: 0.87 },
    ],
    menu_items: [],
    events: [],
    placements: [],
    overall_confidence: 0.85,
    source_file: filename,
    raw_text: 'Mixed campus document',
  }
}
