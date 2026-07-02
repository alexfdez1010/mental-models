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

export { MapTerritoryZoom, default as MapTerritoryZoomDefault } from '@/components/react/MapTerritoryZoom';
export type { MapTerritoryZoomProps, MapTerritoryStep } from '@/components/react/MapTerritoryZoom';

export { MapDriftScrubber, default as MapDriftScrubberDefault } from '@/components/react/MapDriftScrubber';
export type { MapDriftScrubberProps, MapDriftStep } from '@/components/react/MapDriftScrubber';

export { FirstPrinciplesBuilder, default as FirstPrinciplesBuilderDefault } from '@/components/react/FirstPrinciplesBuilder';
export type { FirstPrinciplesBuilderProps, FirstPrinciplesPart } from '@/components/react/FirstPrinciplesBuilder';

export { InversionFlip, default as InversionFlipDefault } from '@/components/react/InversionFlip';
export type { InversionFlipProps, InversionPair } from '@/components/react/InversionFlip';

export { ConsequenceTree, default as ConsequenceTreeDefault } from '@/components/react/ConsequenceTree';
export type { ConsequenceTreeProps, ConsequenceNode, ConsequenceValence } from '@/components/react/ConsequenceTree';

export { OpportunityCostChooser, default as OpportunityCostChooserDefault } from '@/components/react/OpportunityCostChooser';
export type { OpportunityCostChooserProps, OpportunityCostScenario, OpportunityCostOption } from '@/components/react/OpportunityCostChooser';

export { ExpectedValueCalculator, default as ExpectedValueCalculatorDefault } from '@/components/react/ExpectedValueCalculator';
export type { ExpectedValueCalculatorProps, ExpectedValueScenario, ExpectedValueOutcome } from '@/components/react/ExpectedValueCalculator';

export { BaseRateGrid, default as BaseRateGridDefault } from '@/components/react/BaseRateGrid';
export type { BaseRateGridProps } from '@/components/react/BaseRateGrid';

export { IncentiveSlider, default as IncentiveSliderDefault } from '@/components/react/IncentiveSlider';
export type { IncentiveSliderProps } from '@/components/react/IncentiveSlider';

export { SupplyDemandChart, default as SupplyDemandChartDefault } from '@/components/react/SupplyDemandChart';
export type { SupplyDemandChartProps, PriceControl } from '@/components/react/SupplyDemandChart';

export { ElasticityExplorer, default as ElasticityExplorerDefault } from '@/components/react/ElasticityExplorer';
export type { ElasticityExplorerProps } from '@/components/react/ElasticityExplorer';

export { SelectionSimulator, default as SelectionSimulatorDefault } from '@/components/react/SelectionSimulator';
export type { SelectionSimulatorProps } from '@/components/react/SelectionSimulator';

export { CompoundingCurve, default as CompoundingCurveDefault } from '@/components/react/CompoundingCurve';
export type { CompoundingCurveProps } from '@/components/react/CompoundingCurve';

export { EarlyVsLate, default as EarlyVsLateDefault } from '@/components/react/EarlyVsLate';
export type { EarlyVsLateProps } from '@/components/react/EarlyVsLate';

export { RazorBalance, default as RazorBalanceDefault } from '@/components/react/RazorBalance';
export type { RazorBalanceProps, RazorScenario, RazorExplanation } from '@/components/react/RazorBalance';

export { CircleOfCompetence, default as CircleOfCompetenceDefault } from '@/components/react/CircleOfCompetence';
export type { CircleOfCompetenceProps, CircleDomain, CircleDecision } from '@/components/react/CircleOfCompetence';

export { WasonTask, default as WasonTaskDefault } from '@/components/react/WasonTask';
export type { WasonTaskProps, WasonGuess } from '@/components/react/WasonTask';

export { MarginOfSafetyMeter, default as MarginOfSafetyMeterDefault } from '@/components/react/MarginOfSafetyMeter';
export type { MarginOfSafetyMeterProps } from '@/components/react/MarginOfSafetyMeter';

export { ComparativeAdvantageExplorer, default as ComparativeAdvantageExplorerDefault } from '@/components/react/ComparativeAdvantageExplorer';
export type { ComparativeAdvantageExplorerProps, CAGood, CAParty } from '@/components/react/ComparativeAdvantageExplorer';

export { CommonsDepletion, default as CommonsDepletionDefault } from '@/components/react/CommonsDepletion';
export type { CommonsDepletionProps } from '@/components/react/CommonsDepletion';

export { SchellingGrid, default as SchellingGridDefault } from '@/components/react/SchellingGrid';
export type { SchellingGridProps } from '@/components/react/SchellingGrid';

export { EmergenceFlock, default as EmergenceFlockDefault } from '@/components/react/EmergenceFlock';
export type { EmergenceFlockProps } from '@/components/react/EmergenceFlock';

export { PayoffMatrix, default as PayoffMatrixDefault } from '@/components/react/PayoffMatrix';
export type { PayoffMatrixProps, PayoffCell, PayoffGrid } from '@/components/react/PayoffMatrix';

export { IteratedDilemma, default as IteratedDilemmaDefault } from '@/components/react/IteratedDilemma';
export type { IteratedDilemmaProps, DilemmaStrategyOption, StrategyKey } from '@/components/react/IteratedDilemma';

export { LoopSimulator, default as LoopSimulatorDefault } from '@/components/react/LoopSimulator';
export type { LoopSimulatorProps } from '@/components/react/LoopSimulator';

export { BayesCalculator, default as BayesCalculatorDefault } from '@/components/react/BayesCalculator';
export type { BayesCalculatorProps } from '@/components/react/BayesCalculator';

export { AvailabilityGauge, default as AvailabilityGaugeDefault } from '@/components/react/AvailabilityGauge';
export type { AvailabilityGaugeProps, AvailabilityItem } from '@/components/react/AvailabilityGauge';

export { PipelineThroughput, default as PipelineThroughputDefault } from '@/components/react/PipelineThroughput';
export type { PipelineThroughputProps } from '@/components/react/PipelineThroughput';

export { CoevolutionRace, default as CoevolutionRaceDefault } from '@/components/react/CoevolutionRace';
export type { CoevolutionRaceProps } from '@/components/react/CoevolutionRace';

export { TailExplorer, default as TailExplorerDefault } from '@/components/react/TailExplorer';
export type { TailExplorerProps } from '@/components/react/TailExplorer';

export { CalibrationLab, default as CalibrationLabDefault } from '@/components/react/CalibrationLab';
export type { CalibrationLabProps, CalibrationClaim } from '@/components/react/CalibrationLab';

export { ValueFunctionExplorer, default as ValueFunctionExplorerDefault } from '@/components/react/ValueFunctionExplorer';
export type { ValueFunctionExplorerProps } from '@/components/react/ValueFunctionExplorer';

export { StockFlowBathtub, default as StockFlowBathtubDefault } from '@/components/react/StockFlowBathtub';
export type { StockFlowBathtubProps } from '@/components/react/StockFlowBathtub';

export { ExternalityChart, default as ExternalityChartDefault } from '@/components/react/ExternalityChart';
export type { ExternalityChartProps } from '@/components/react/ExternalityChart';

export { MoatErosion, default as MoatErosionDefault } from '@/components/react/MoatErosion';
export type { MoatErosionProps } from '@/components/react/MoatErosion';

export { NicheOverlap, default as NicheOverlapDefault } from '@/components/react/NicheOverlap';
export type { NicheOverlapProps } from '@/components/react/NicheOverlap';

export { LeverageLadder, default as LeverageLadderDefault } from '@/components/react/LeverageLadder';
export type { LeverageLadderProps, LeverageRung } from '@/components/react/LeverageLadder';

export { BiasStack, default as BiasStackDefault } from '@/components/react/BiasStack';
export type { BiasStackProps, BiasStackItem } from '@/components/react/BiasStack';

export { RegressionScatter, default as RegressionScatterDefault } from '@/components/react/RegressionScatter';
export type { RegressionScatterProps } from '@/components/react/RegressionScatter';
