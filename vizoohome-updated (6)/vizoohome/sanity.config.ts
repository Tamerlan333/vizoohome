"use client";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./sanity/schemaTypes";
export default defineConfig({
  name: "vizoohome", title: "VizooHome",
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!, dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  basePath: "/studio", plugins: [structureTool()], schema: { types: schemaTypes },
});
