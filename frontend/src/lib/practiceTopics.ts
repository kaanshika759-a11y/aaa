/**
 * lib/practiceTopics.ts
 * Practice modes and topic lists for the confidence coach
 */

export interface PracticeMode {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  topics: string[];
  promptTemplate: string;
}

export const PRACTICE_MODES: PracticeMode[] = [
  {
    id: "daily-conversation",
    title: "Daily Conversation",
    description: "Practice everyday English for college, markets, offices and daily life",
    icon: "💬",
    color: "#0062ff",
    topics: [
      "Asking for directions",
      "Ordering food at a restaurant",
      "Introducing yourself",
      "Daily activities",
      "Talking to a shopkeeper",
      "Making a phone call",
      "Greeting new people",
      "Talking about your weekend",
      "Asking for help",
      "Discussing the weather",
    ],
    promptTemplate: "You are helping a student practice daily English conversation. Be friendly and natural.",
  },
  {
    id: "interview",
    title: "Interview Practice",
    description: "Prepare for job interviews, college admissions and scholarship interviews",
    icon: "🎯",
    color: "#f59e0b",
    topics: [
      "Tell me about yourself",
      "Why do you want this job/course?",
      "What are your strengths?",
      "What are your weaknesses?",
      "Where do you see yourself in 5 years?",
      "Why should we select you?",
      "Describe a challenge you faced",
      "What are your career goals?",
    ],
    promptTemplate: "You are a friendly but professional interviewer helping a student practice.",
  },
  {
    id: "self-introduction",
    title: "Self Introduction",
    description: "Learn to introduce yourself confidently in any situation",
    icon: "🙋",
    color: "#a855f7",
    topics: [
      "Introduce yourself in 30 seconds",
      "Introduce yourself in a college setting",
      "Introduce yourself in a job interview",
      "Introduce yourself at a networking event",
      "Introduce yourself to your new class",
      "Introduce yourself to a teacher/professor",
    ],
    promptTemplate: "You are a communication coach helping a student perfect their self-introduction.",
  },
  {
    id: "presentation",
    title: "Presentation Practice",
    description: "Build skills for class presentations, seminars and public speaking",
    icon: "📊",
    color: "#06b6d4",
    topics: [
      "Present your project",
      "Present a topic in 2 minutes",
      "Give an opening statement",
      "Explain a concept to your class",
      "Present your research findings",
      "Product/idea pitch",
      "Environmental awareness speech",
      "My dream career presentation",
    ],
    promptTemplate: "You are a presentation coach. Give feedback on clarity, structure and confidence.",
  },
  {
    id: "viva",
    title: "Viva Practice",
    description: "Prepare for oral exams, thesis defense and academic viva",
    icon: "🎓",
    color: "#10b981",
    topics: [
      "Explain your project methodology",
      "What challenges did you face in your project?",
      "Explain a concept from your subject",
      "Why did you choose this topic?",
      "What are the future applications of your work?",
      "Defend your conclusions",
      "Compare two approaches in your field",
    ],
    promptTemplate: "You are an academic examiner conducting a viva. Ask probing but fair questions.",
  },
  {
    id: "group-discussion",
    title: "Group Discussion",
    description: "Practice expressing opinions and ideas in group discussions",
    icon: "🗣️",
    color: "#f43f5e",
    topics: [
      "Social media: benefits vs. harms",
      "Online education vs. offline education",
      "Should college be free?",
      "Impact of technology on youth",
      "Climate change solutions",
      "Women in leadership roles",
      "Urban vs. rural life",
      "Importance of sports in education",
    ],
    promptTemplate: "You are a group discussion moderator. Encourage the student to express their views clearly.",
  },
  {
    id: "college-conversation",
    title: "College Life",
    description: "Navigate college interactions confidently with teachers, friends and staff",
    icon: "🏫",
    color: "#8b5cf6",
    topics: [
      "Talk to a professor about your doubts",
      "Request an extension for an assignment",
      "Participate in a class discussion",
      "Ask for a recommendation letter",
      "Discuss a project with teammates",
      "Talk to the college office/admin",
      "Make new friends in college",
      "Attend a college event",
    ],
    promptTemplate: "You are helping a student navigate college interactions confidently in English.",
  },
  {
    id: "public-speaking",
    title: "Public Speaking",
    description: "Practice addressing an audience, giving speeches and debates",
    icon: "🎤",
    color: "#ef4444",
    topics: [
      "Give an inspirational speech",
      "Talk about a social issue",
      "Deliver a vote of thanks",
      "Welcome address",
      "Motivational speech for students",
      "Debate: Support a given topic",
      "Debate: Oppose a given topic",
    ],
    promptTemplate: "You are a speech coach. Give feedback on delivery, confidence and impact.",
  },
  {
    id: "vocabulary",
    title: "Vocabulary Practice",
    description: "Learn and use new English words in context",
    icon: "📚",
    color: "#f97316",
    topics: [
      "Use 5 new words in sentences",
      "Describe your day using formal vocabulary",
      "Practice professional English terms",
      "Learn idioms for daily use",
      "Academic vocabulary practice",
      "Describe a picture using rich vocabulary",
    ],
    promptTemplate: "You are a vocabulary coach. Help the student use new words correctly and naturally.",
  },
  {
    id: "grammar",
    title: "Grammar Practice",
    description: "Fix common grammar mistakes and improve sentence structure",
    icon: "✏️",
    color: "#6366f1",
    topics: [
      "Practice using tenses correctly",
      "Form questions and answers",
      "Use articles (a, an, the) correctly",
      "Active vs. passive voice",
      "Reported speech practice",
      "Conditional sentences",
    ],
    promptTemplate: "You are a grammar coach. Gently correct mistakes and explain the rules clearly.",
  },
  {
    id: "pronunciation",
    title: "Pronunciation Practice",
    description: "Master difficult English words, intonation, and rhythm",
    icon: "🎵",
    color: "#ec4899",
    topics: [
      "Tricky words (schedule, Wednesday, comfortable, vehicle)",
      "Silent letters (doubt, subtle, debt, receipt)",
      "Word stress & intonation practice",
      "Vowel & consonant sound clarity",
      "Sentence rhythm & pacing",
    ],
    promptTemplate: "You are a pronunciation & accent neutrality coach. Give clear phonetic and mouth-movement guidance.",
  },
];

export const CAMERA_PRACTICE_TOPICS = [
  { id: "introduce-yourself", title: "Introduce Yourself", prompt: "Introduce yourself — your name, background, interests and goals.", duration: 60 },
  { id: "talk-college", title: "Talk About Your College", prompt: "Tell us about your college — what you study, what you enjoy, and your experiences.", duration: 60 },
  { id: "talk-school", title: "Talk About Your School", prompt: "Tell us about your school, your favourite subjects and teachers.", duration: 60 },
  { id: "favorite-subject", title: "Favourite Subject", prompt: "Talk about your favourite subject and why you love it.", duration: 60 },
  { id: "explain-project", title: "Explain Your Project", prompt: "Explain a project you worked on — what it is, how you did it, and what you learned.", duration: 90 },
  { id: "short-presentation", title: "Short Presentation", prompt: "Give a 90-second presentation on any topic you know well.", duration: 90 },
  { id: "interview-practice", title: "Interview Practice", prompt: "Answer this interview question: 'Tell me about yourself and why you are the right candidate for this opportunity.'", duration: 90 },
  { id: "my-goals", title: "My Goals", prompt: "Talk about your goals — what you want to achieve in the next 2-3 years.", duration: 60 },
  { id: "random", title: "Random Topic", prompt: "Speak confidently about the first topic that comes to your mind. Just start talking!", duration: 60 },
];

export const EDUCATION_LEVELS = [
  { id: "class-5-8", label: "Class 5 – 8" },
  { id: "class-9-12", label: "Class 9 – 12" },
  { id: "college", label: "College / University" },
  { id: "other", label: "Other" },
];

export const LEARNING_GOALS = [
  { id: "english-speaking", label: "English Speaking", icon: "🗣️" },
  { id: "conversation", label: "Daily Conversation", icon: "💬" },
  { id: "grammar", label: "Grammar", icon: "✏️" },
  { id: "vocabulary", label: "Vocabulary", icon: "📚" },
  { id: "pronunciation", label: "Pronunciation", icon: "🎵" },
  { id: "interview", label: "Interview Prep", icon: "🎯" },
  { id: "presentation", label: "Presentation Skills", icon: "📊" },
  { id: "confidence", label: "Overall Confidence", icon: "🔥" },
];
