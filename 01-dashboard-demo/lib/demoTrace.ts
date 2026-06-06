import fixture from "../fixtures/shopee_demo_trace.json";
import { defaultParameters, defaultProduct } from "./productModel";
import { createDashboardTrace } from "./simulationProjection";
import type { DashboardTrace } from "./types";

export const fixtureTrace = fixture as unknown as DashboardTrace;

export const createInitialTrace = () => createDashboardTrace(defaultProduct, defaultParameters);
