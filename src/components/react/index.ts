/**
 * Barrel for the Lessons-template React islands.
 *
 * These are the generic, **topic-agnostic** building blocks every lesson can
 * reuse: assessment (MCQ, Quiz, FinalExam), exercises (FillBlank, Categorize,
 * MatchConcepts), presentation (Callout, Reveal, MindMap) and the structural
 * pieces the layouts/catalog need (CourseGraph, LessonComplete, CourseComplete,
 * ProgressTransfer).
 *
 * Author new, subject-specific chart/animation islands as their own files and
 * add them here. Keep every island locale-agnostic — pass user-facing strings
 * as props (see DESIGN.md and the `exercise-components` / `lesson-animations`
 * skills).
 *
 * Import components and their prop/option types from a single path:
 * @example
 *   import { MCQ, Quiz, type MCQProps, type QuizProps } from '@/components/react';
 */

export { cx } from '@/components/react/cx';

export { MCQ, default as MCQDefault } from '@/components/react/MCQ';
export type { MCQProps, MCQOption } from '@/components/react/MCQ';

export { Quiz, default as QuizDefault } from '@/components/react/Quiz';
export type { QuizProps } from '@/components/react/Quiz';

export { FinalExam, default as FinalExamDefault } from '@/components/react/FinalExam';
export type { FinalExamProps, FinalExamQuestion } from '@/components/react/FinalExam';

export { Reveal, default as RevealDefault } from '@/components/react/Reveal';
export type { RevealProps } from '@/components/react/Reveal';

export { Callout, default as CalloutDefault } from '@/components/react/Callout';
export type { CalloutProps, CalloutVariant } from '@/components/react/Callout';

export { MatchConcepts, default as MatchConceptsDefault } from '@/components/react/MatchConcepts';
export type { MatchConceptsProps, MatchPair } from '@/components/react/MatchConcepts';

export { MindMap, default as MindMapDefault } from '@/components/react/MindMap';
export type { MindMapProps, MindNode } from '@/components/react/MindMap';

export { Categorize, default as CategorizeDefault } from '@/components/react/Categorize';
export type { CategorizeProps, CategorizeItem } from '@/components/react/Categorize';

export { FillBlank, default as FillBlankDefault } from '@/components/react/FillBlank';
export type { FillBlankProps } from '@/components/react/FillBlank';

export { CourseGraph, default as CourseGraphDefault } from '@/components/react/CourseGraph';
export type { CourseGraphProps, CourseNode, Difficulty, TagOption } from '@/components/react/CourseGraph';

export { CourseComplete, default as CourseCompleteDefault } from '@/components/react/CourseComplete';
export type { CourseCompleteProps } from '@/components/react/CourseComplete';

export { ProgressTransfer, default as ProgressTransferDefault } from '@/components/react/ProgressTransfer';
export type { ProgressTransferProps } from '@/components/react/ProgressTransfer';

export { LessonComplete, default as LessonCompleteDefault } from '@/components/react/LessonComplete';
export type { LessonCompleteProps } from '@/components/react/LessonComplete';
