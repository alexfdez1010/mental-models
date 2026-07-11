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

export { CriticalMass, default as CriticalMassDefault } from '@/components/react/CriticalMass';
export type { CriticalMassProps } from '@/components/react/CriticalMass';

export { MixedStrategyExplorer, default as MixedStrategyExplorerDefault } from '@/components/react/MixedStrategyExplorer';
export type { MixedStrategyExplorerProps, MixCell, MixGrid } from '@/components/react/MixedStrategyExplorer';

export { PayoffExplorer, default as PayoffExplorerDefault } from '@/components/react/PayoffExplorer';
export type { PayoffExplorerProps, PayoffShape, PayoffShapeOption } from '@/components/react/PayoffExplorer';

export { FitnessLandscape, default as FitnessLandscapeDefault } from '@/components/react/FitnessLandscape';
export type { FitnessLandscapeProps } from '@/components/react/FitnessLandscape';

export { AuctionSandbox, default as AuctionSandboxDefault } from '@/components/react/AuctionSandbox';
export type { AuctionSandboxProps } from '@/components/react/AuctionSandbox';

export { CutAndChoose, default as CutAndChooseDefault } from '@/components/react/CutAndChoose';
export type { CutAndChooseProps } from '@/components/react/CutAndChoose';

export { DecisionDesk, default as DecisionDeskDefault } from '@/components/react/DecisionDesk';
export type { DecisionDeskProps, DecisionScenario, DecisionLens } from '@/components/react/DecisionDesk';

export { ManyWorldsExplorer, default as ManyWorldsExplorerDefault } from '@/components/react/ManyWorldsExplorer';
export type { ManyWorldsExplorerProps, WorldStrategy } from '@/components/react/ManyWorldsExplorer';

export { ComplianceMeter, default as ComplianceMeterDefault } from '@/components/react/ComplianceMeter';
export type { ComplianceMeterProps, ComplianceLever } from '@/components/react/ComplianceMeter';

export { EvoTournament, default as EvoTournamentDefault } from '@/components/react/EvoTournament';
export type { EvoTournamentProps, EvoStrategyOption, EvoStrategyKey } from '@/components/react/EvoTournament';

export { CommitmentGame, default as CommitmentGameDefault } from '@/components/react/CommitmentGame';
export type { CommitmentGameProps } from '@/components/react/CommitmentGame';

export { ReframeLab, default as ReframeLabDefault } from '@/components/react/ReframeLab';
export type { ReframeLabProps, ReframeSolution, ReframeAssumption } from '@/components/react/ReframeLab';

export { LockInExplorer, default as LockInExplorerDefault } from '@/components/react/LockInExplorer';
export type { LockInExplorerProps } from '@/components/react/LockInExplorer';

export { ContractDesigner, default as ContractDesignerDefault } from '@/components/react/ContractDesigner';
export type { ContractDesignerProps } from '@/components/react/ContractDesigner';

export { CumulativeAdvantageEngine, default as CumulativeAdvantageEngineDefault } from '@/components/react/CumulativeAdvantageEngine';
export type { CumulativeAdvantageEngineProps } from '@/components/react/CumulativeAdvantageEngine';

export { DebiasingBench, default as DebiasingBenchDefault } from '@/components/react/DebiasingBench';
export type { DebiasingBenchProps, DebiasingTool, DebiasingScenario, FixKind } from '@/components/react/DebiasingBench';

export { SignallingSeparator, default as SignallingSeparatorDefault } from '@/components/react/SignallingSeparator';
export type { SignallingSeparatorProps } from '@/components/react/SignallingSeparator';

export { ReflexivityLoop, default as ReflexivityLoopDefault } from '@/components/react/ReflexivityLoop';
export type { ReflexivityLoopProps } from '@/components/react/ReflexivityLoop';

export { FragilityTester, default as FragilityTesterDefault } from '@/components/react/FragilityTester';
export type { FragilityTesterProps, FragilitySystem } from '@/components/react/FragilityTester';

export { ErgodicityEngine, default as ErgodicityEngineDefault } from '@/components/react/ErgodicityEngine';
export type { ErgodicityEngineProps } from '@/components/react/ErgodicityEngine';

export { NoFreeLunchBoard, default as NoFreeLunchBoardDefault } from '@/components/react/NoFreeLunchBoard';
export type { NoFreeLunchBoardProps, NoFreeLunchStrategy } from '@/components/react/NoFreeLunchBoard';

export { CommonKnowledgeCoordinator, default as CommonKnowledgeCoordinatorDefault } from '@/components/react/CommonKnowledgeCoordinator';
export type { CommonKnowledgeCoordinatorProps } from '@/components/react/CommonKnowledgeCoordinator';

export { DispersedKnowledgeMarket, default as DispersedKnowledgeMarketDefault } from '@/components/react/DispersedKnowledgeMarket';
export type { DispersedKnowledgeMarketProps } from '@/components/react/DispersedKnowledgeMarket';

export { HawkDoveLab, default as HawkDoveLabDefault } from '@/components/react/HawkDoveLab';
export type { HawkDoveLabProps } from '@/components/react/HawkDoveLab';

export { GoodhartPressureDial, default as GoodhartPressureDialDefault } from '@/components/react/GoodhartPressureDial';
export type { GoodhartPressureDialProps } from '@/components/react/GoodhartPressureDial';

export { CascadeLine, default as CascadeLineDefault } from '@/components/react/CascadeLine';
export type { CascadeLineProps } from '@/components/react/CascadeLine';

export { VoiLab, default as VoiLabDefault } from '@/components/react/VoiLab';
export type { VoiLabProps } from '@/components/react/VoiLab';

export { CreativeDestructionWave, default as CreativeDestructionWaveDefault } from '@/components/react/CreativeDestructionWave';
export type { CreativeDestructionWaveProps } from '@/components/react/CreativeDestructionWave';

export { PunctuatedTimeline, default as PunctuatedTimelineDefault } from '@/components/react/PunctuatedTimeline';
export type { PunctuatedTimelineProps } from '@/components/react/PunctuatedTimeline';

export { PreferenceCascade, default as PreferenceCascadeDefault } from '@/components/react/PreferenceCascade';
export type { PreferenceCascadeProps } from '@/components/react/PreferenceCascade';

export { WinnerCurseSim, default as WinnerCurseSimDefault } from '@/components/react/WinnerCurseSim';
export type { WinnerCurseSimProps } from '@/components/react/WinnerCurseSim';
