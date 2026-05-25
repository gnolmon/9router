import { NextResponse } from "next/server";
import { getCustomModels, getModelAliases, setModelAlias } from "@/models";
import { getDisabledModels } from "@/lib/disabledModelsDb";
import { AI_MODELS } from "@/shared/constants/config";
import { getProviderAlias } from "@/shared/constants/providers";

// GET /api/models - Get models with aliases
export async function GET() {
  try {
    const modelAliases = await getModelAliases();
    const disabled = await getDisabledModels();
    const customModels = await getCustomModels();

    const isModelDisabled = (providerAlias, providerId, modelId) => {
      const aliasList = disabled[providerAlias] || [];
      const providerList = disabled[providerId] || [];
      return aliasList.includes(modelId) || providerList.includes(modelId);
    };

    const modelsByFullModel = new Map();

    for (const model of AI_MODELS) {
      const providerAlias = getProviderAlias(model.provider) || model.provider;
      if (isModelDisabled(providerAlias, model.provider, model.model)) {
        continue;
      }

      const fullModel = `${model.provider}/${model.model}`;
      modelsByFullModel.set(fullModel, {
        ...model,
        fullModel,
        alias: modelAliases[fullModel] || model.model,
      });
    }

    for (const customModel of customModels) {
      const providerAlias = String(customModel?.providerAlias || "").trim();
      const modelId = String(customModel?.id || "").trim();
      const modelType = customModel?.type || "llm";
      if (!providerAlias || !modelId) continue;
      if (modelType !== "llm") continue;
      if (isModelDisabled(providerAlias, providerAlias, modelId)) continue;

      const fullModel = `${providerAlias}/${modelId}`;
      if (modelsByFullModel.has(fullModel)) continue;

      modelsByFullModel.set(fullModel, {
        provider: providerAlias,
        model: modelId,
        name: customModel?.name || modelId,
        type: modelType,
        fullModel,
        alias: modelAliases[fullModel] || customModel?.name || modelId,
      });
    }

    const models = Array.from(modelsByFullModel.values());

    return NextResponse.json({ models });
  } catch (error) {
    console.log("Error fetching models:", error);
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}

// PUT /api/models - Update model alias
export async function PUT(request) {
  try {
    const body = await request.json();
    const { model, alias } = body;

    if (!model || !alias) {
      return NextResponse.json({ error: "Model and alias required" }, { status: 400 });
    }

    const modelAliases = await getModelAliases();

    // Check if alias already exists for different model
    const existingModel = Object.entries(modelAliases).find(
      ([key, val]) => val === alias && key !== model
    );

    if (existingModel) {
      return NextResponse.json({ error: "Alias already in use" }, { status: 400 });
    }

    // Update alias
    await setModelAlias(model, alias);

    return NextResponse.json({ success: true, model, alias });
  } catch (error) {
    console.log("Error updating alias:", error);
    return NextResponse.json({ error: "Failed to update alias" }, { status: 500 });
  }
}
