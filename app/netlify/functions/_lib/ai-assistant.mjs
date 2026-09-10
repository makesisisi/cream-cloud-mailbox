import { getDatabase } from "@netlify/database";
import OpenAI from "openai";
import { readPrivateImage } from "./chat-attachments.mjs";

let database;

function getDb() {
  if (!database) database = getDatabase();
  return database;
}

export const AI_PROMPT_VERSION = "emotion-support-v2-vision";
export const DEFAULT_GATEWAY_MODEL = "deepseek/deepseek-v4-pro";
export const DEFAULT_GATEWAY_IMAGE_MODEL = "deepseek/deepseek-v4-flash-vision-exp";
const DEFAULT_DIRECT_MODEL = "deepseek-v4-pro";
const DEFAULT_DIRECT_IMAGE_MODEL = "deepseek-v4-flash-vision-exp";
const MAX_CONTEXT_MESSAGES = 10;
const MAX_CONTEXT_CHARACTERS = 6000;

const allowedSafetyLevels = new Set(["normal", "watch", "urgent"]);
const urgentPatterns = [
  /(?:不想活|想死|自杀|结束生命|结束自己的生命)/u,
  /(?:伤害自己|自残|割腕|跳楼|吞药)/u,
  /(?:活着没意思|活不下去|撑不下去).{0,12}(?:了|现在|今晚|今天)?/u,
];

let schemaPromise;

function readEnv(name) {
  return globalThis.Netlify?.env?.get?.(name) ?? process.env[name];
}

export async function ensureAiAnalysisSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await getDb().pool.query(
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_consent BOOLEAN NOT NULL DEFAULT FALSE",
      );
      await getDb().pool.query(`
        CREATE TABLE IF NOT EXISTS conversation_ai_analyses (
          id UUID PRIMARY KEY,
          conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          source_message_id UUID NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
          status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
          primary_emotion TEXT,
          secondary_emotions JSONB NOT NULL DEFAULT '[]'::jsonb,
          intensity SMALLINT,
          current_need TEXT,
          observation TEXT,
          suggested_opening TEXT,
          follow_up_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
          avoid_phrases JSONB NOT NULL DEFAULT '[]'::jsonb,
          safety_level TEXT,
          safety_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
          confidence NUMERIC(4, 3),
          model TEXT,
          prompt_version TEXT NOT NULL,
          error_code TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (source_message_id, prompt_version)
        )
      `);
      await getDb().pool.query(
        "CREATE INDEX IF NOT EXISTS conversation_ai_analyses_latest_idx ON conversation_ai_analyses (conversation_id, created_at DESC)",
      );
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

function cleanText(value, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 500) : fallback;
}

function cleanList(value, limit = 3) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean).slice(0, limit);
}

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

export function detectUrgentSafety(text) {
  return urgentPatterns.some((pattern) => pattern.test(String(text ?? "")));
}

export function normalizeAiResult(value, sourceText = "") {
  const parsed = value && typeof value === "object" ? value : {};
  const detectedUrgent = detectUrgentSafety(sourceText);
  const modelSafety = allowedSafetyLevels.has(parsed.safetyLevel) ? parsed.safetyLevel : "normal";
  const safetyLevel = detectedUrgent ? "urgent" : modelSafety;
  const safetyReasons = cleanList(parsed.safetyReasons, 3);
  if (detectedUrgent && !safetyReasons.length) {
    safetyReasons.push("文本中出现需要立即人工复核的高风险表达");
  }

  return {
    primaryEmotion: cleanText(parsed.primaryEmotion, "需要进一步倾听"),
    secondaryEmotions: cleanList(parsed.secondaryEmotions, 3),
    intensity: Math.round(clampNumber(parsed.intensity, 0, 3, 1)),
    currentNeed: cleanText(parsed.currentNeed, "先被认真倾听"),
    observation: cleanText(parsed.observation, "目前信息有限，建议先确认对方的感受。"),
    suggestedOpening: cleanText(
      parsed.suggestedOpening,
      "谢谢你愿意说出来。我在这里，我们可以慢慢聊。",
    ),
    followUpQuestions: cleanList(parsed.followUpQuestions, 2),
    avoidPhrases: cleanList(parsed.avoidPhrases, 3),
    safetyLevel,
    safetyReasons,
    confidence: clampNumber(parsed.confidence, 0, 1, 0.5),
  };
}

function toPublicAnalysis(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceMessageId: row.source_message_id,
    status: row.status,
    primaryEmotion: row.primary_emotion,
    secondaryEmotions: row.secondary_emotions ?? [],
    intensity: row.intensity,
    currentNeed: row.current_need,
    observation: row.observation,
    suggestedOpening: row.suggested_opening,
    followUpQuestions: row.follow_up_questions ?? [],
    avoidPhrases: row.avoid_phrases ?? [],
    safetyLevel: row.safety_level,
    safetyReasons: row.safety_reasons ?? [],
    confidence: row.confidence === null ? null : Number(row.confidence),
    model: row.model,
    promptVersion: row.prompt_version,
    errorCode: row.error_code,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function loadLatestAiAnalysis(conversationId) {
  await ensureAiAnalysisSchema();
  const { rows } = await getDb().pool.query(
    "SELECT * FROM conversation_ai_analyses WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1",
    [conversationId],
  );
  return toPublicAnalysis(rows[0]);
}

export async function loadLatestAiAnalyses(conversationIds) {
  if (!conversationIds.length) return new Map();
  await ensureAiAnalysisSchema();
  const { rows } = await getDb().pool.query(
    `SELECT DISTINCT ON (conversation_id) *
       FROM conversation_ai_analyses
      WHERE conversation_id = ANY($1::uuid[])
      ORDER BY conversation_id, created_at DESC`,
    [conversationIds],
  );
  return new Map(rows.map((row) => [row.conversation_id, toPublicAnalysis(row)]));
}

export async function queueAiAnalysis(conversationId, sourceMessageId) {
  await ensureAiAnalysisSchema();
  const { rows } = await getDb().pool.query(
    "SELECT ai_consent FROM conversations WHERE id = $1",
    [conversationId],
  );
  if (!rows[0]?.ai_consent) return null;

  const id = crypto.randomUUID();
  const result = await getDb().pool.query(
    `INSERT INTO conversation_ai_analyses
      (id, conversation_id, source_message_id, status, prompt_version)
     VALUES ($1, $2, $3, 'pending', $4)
     ON CONFLICT (source_message_id, prompt_version)
     DO UPDATE SET status = 'pending', error_code = NULL, updated_at = NOW()
     RETURNING *`,
    [id, conversationId, sourceMessageId, AI_PROMPT_VERSION],
  );
  return toPublicAnalysis(result.rows[0]);
}

function buildContext(topic, need, messages) {
  const selected = messages
    .filter((message) => message.sender === "client" || message.sender === "admin")
    .slice(-MAX_CONTEXT_MESSAGES);
  const lines = selected.map((message) => `${message.sender === "client" ? "倾诉者" : "倾听员"}：${message.body}`);
  while (lines.join("\n").length > MAX_CONTEXT_CHARACTERS && lines.length > 1) lines.shift();
  return `倾诉主题：${topic}\n倾诉者期待：${need}\n\n最近对话：\n${lines.join("\n")}`;
}

function createAiClient() {
  const directKey = readEnv("DEEPSEEK_API_KEY");
  if (directKey) {
    return {
      client: new OpenAI({
        apiKey: directKey,
        baseURL: "https://api.deepseek.com",
        timeout: 20_000,
        maxRetries: 1,
      }),
      model: readEnv("DEEPSEEK_MODEL") || DEFAULT_DIRECT_MODEL,
      imageFallbackModel: readEnv("DEEPSEEK_IMAGE_MODEL") || DEFAULT_DIRECT_IMAGE_MODEL,
    };
  }

  return {
    client: new OpenAI({ timeout: 20_000, maxRetries: 1 }),
    model: readEnv("AI_EMOTION_MODEL") || DEFAULT_GATEWAY_MODEL,
    imageFallbackModel: readEnv("AI_IMAGE_MODEL") || DEFAULT_GATEWAY_IMAGE_MODEL,
  };
}

export function isUnsupportedImageError(error) {
  const message = String(error?.error?.message ?? error?.message ?? "").toLowerCase();
  return (error?.status === 400 || error?.status === 404)
    && (message.includes("image") || message.includes("vision") || message.includes("multimodal"));
}

async function loadSourceImage(conversationId, sourceMessageId) {
  const { rows } = await getDb().pool.query(
    `SELECT storage_key, content_type
       FROM conversation_attachments
      WHERE conversation_id = $1 AND message_id = $2
      ORDER BY created_at ASC, id ASC
      LIMIT 1`,
    [conversationId, sourceMessageId],
  );
  if (!rows[0]) return null;
  const data = await readPrivateImage(rows[0].storage_key, "arrayBuffer");
  if (!data) return null;
  return {
    contentType: rows[0].content_type,
    dataUrl: `data:${rows[0].content_type};base64,${Buffer.from(data).toString("base64")}`,
  };
}

function userContentForAnalysis(contextText, sourceImage) {
  if (!sourceImage) return contextText;
  return [
    {
      type: "text",
      text: `${contextText}\n\n最新一条倾诉附有一张图片。只分析图片中与对方当前感受和求助语境直接相关的可见线索，不识别身份，不猜测年龄、性别、疾病或其他敏感属性。`,
    },
    {
      type: "image_url",
      image_url: { url: sourceImage.dataUrl, detail: "low" },
    },
  ];
}

function errorCodeFor(error) {
  if (error?.name === "APIConnectionTimeoutError") return "timeout";
  if (error?.status === 429) return "rate_limited";
  if (error?.status === 401 || error?.status === 403) return "configuration";
  if (error instanceof SyntaxError) return "invalid_json";
  return "provider_error";
}

export async function runAiAnalysis(conversationId, sourceMessageId) {
  await ensureAiAnalysisSchema();
  try {
    const { rows: sourceRows } = await getDb().pool.query(
      `SELECT m.body, m.sender, c.topic, c.need, c.ai_consent
         FROM conversation_messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE m.id = $1 AND m.conversation_id = $2`,
      [sourceMessageId, conversationId],
    );
    const source = sourceRows[0];
    if (!source || source.sender !== "client" || !source.ai_consent) return null;

    const { rows: messages } = await getDb().pool.query(
      `SELECT sender, body, created_at
         FROM conversation_messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC, id ASC`,
      [conversationId],
    );
    const sourceImage = await loadSourceImage(conversationId, sourceMessageId);
    const { client, model, imageFallbackModel } = createAiClient();
    const request = {
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `你是匿名心理倾诉网站的倾听辅助工具，不是医生，也不能进行诊断。请根据对话中的文字和用户主动分享的图片线索，帮助人工倾听员更温柔地回应。\n\n要求：\n1. 只描述“可能的感受”和“可能的需要”，不使用抑郁症、焦虑症等疾病诊断。\n2. 不自动替人作决定，不承诺保密、治愈或绝对安全。\n3. 建议语言自然、简短、非评判，先回应感受，再提出至多两个开放式问题。\n4. 不复述姓名、地址、联系方式等可识别信息，不做人脸识别，不推断年龄、性别、民族、健康状况等敏感属性。\n5. 图片只作为语境线索；看不清或无法确定时明确保持谨慎，不编造画面内容。\n6. safetyLevel 只能是 normal、watch、urgent。出现自伤、自杀、伤害他人或立即危险线索时使用 urgent；信息含糊但需要尽快人工确认时使用 watch。\n7. 只输出合法 json，不要 markdown。\n\nJSON 格式：{"primaryEmotion":"","secondaryEmotions":[],"intensity":0,"currentNeed":"","observation":"","suggestedOpening":"","followUpQuestions":[],"avoidPhrases":[],"safetyLevel":"normal","safetyReasons":[],"confidence":0.5}`,
        },
        {
          role: "user",
          content: userContentForAnalysis(buildContext(source.topic, source.need, messages), sourceImage),
        },
      ],
    };
    let usedModel = model;
    let completion;
    try {
      completion = await client.chat.completions.create({ ...request, model });
    } catch (error) {
      if (!sourceImage || !imageFallbackModel || imageFallbackModel === model || !isUnsupportedImageError(error)) throw error;
      usedModel = imageFallbackModel;
      completion = await client.chat.completions.create({ ...request, model: imageFallbackModel });
    }
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new SyntaxError("empty model response");
    const analysis = normalizeAiResult(JSON.parse(raw), source.body);

    const { rows } = await getDb().pool.query(
      `UPDATE conversation_ai_analyses
          SET status = 'ready', primary_emotion = $1, secondary_emotions = $2::jsonb,
              intensity = $3, current_need = $4, observation = $5, suggested_opening = $6,
              follow_up_questions = $7::jsonb, avoid_phrases = $8::jsonb,
              safety_level = $9, safety_reasons = $10::jsonb, confidence = $11,
              model = $12, error_code = NULL, updated_at = NOW()
        WHERE source_message_id = $13 AND prompt_version = $14
        RETURNING *`,
      [
        analysis.primaryEmotion,
        JSON.stringify(analysis.secondaryEmotions),
        analysis.intensity,
        analysis.currentNeed,
        analysis.observation,
        analysis.suggestedOpening,
        JSON.stringify(analysis.followUpQuestions),
        JSON.stringify(analysis.avoidPhrases),
        analysis.safetyLevel,
        JSON.stringify(analysis.safetyReasons),
        analysis.confidence,
        usedModel,
        sourceMessageId,
        AI_PROMPT_VERSION,
      ],
    );
    return toPublicAnalysis(rows[0]);
  } catch (error) {
    const errorCode = errorCodeFor(error);
    await getDb().pool.query(
      `UPDATE conversation_ai_analyses
          SET status = 'failed', error_code = $1, updated_at = NOW()
        WHERE source_message_id = $2 AND prompt_version = $3`,
      [errorCode, sourceMessageId, AI_PROMPT_VERSION],
    );
    console.error("ai-analysis-error", { conversationId, sourceMessageId, errorCode });
    return null;
  }
}
