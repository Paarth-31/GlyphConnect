import { queryService } from './client';

export async function saveTranscriptChunk(data: {
  sessionId: string;
  speakerId?: string;
  speakerLabel?: string;
  rawText: string;
  cleanedText?: string;
  translatedText?: string;
  targetLang?: string;
  startOffsetMs: number;
  endOffsetMs: number;
  confidence?: number;
}) {
  const rows = await queryService(
    `INSERT INTO transcripts
       (session_id, speaker_id, speaker_label, raw_text, cleaned_text,
        translated_text, target_lang, start_offset_ms, end_offset_ms, confidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      data.sessionId,
      data.speakerId ?? null,
      data.speakerLabel ?? null,
      data.rawText,
      data.cleanedText ?? null,
      data.translatedText ?? null,
      data.targetLang ?? null,
      data.startOffsetMs,
      data.endOffsetMs,
      data.confidence ?? null,
    ]
  );
  return rows[0];
}

export async function assembleAndSaveFullTranscript(
  sessionId: string,
  aiSummary?: string,
  keyTopics?: string[],
  actionItems?: string[]
) {
  const chunks = await queryService(
    `SELECT raw_text, cleaned_text, speaker_label,
            start_offset_ms, end_offset_ms
     FROM   transcripts
     WHERE  session_id = $1
     ORDER  BY start_offset_ms`,
    [sessionId]
  );

  const fullText = chunks
    .map((c: any) => {
      const label = c.speaker_label ? `[${c.speaker_label}] ` : '';
      return `${label}${c.cleaned_text ?? c.raw_text}`;
    })
    .join('\n');

  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  await queryService(
    `INSERT INTO session_transcripts
       (session_id, full_text, word_count, ai_summary, key_topics, action_items)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (session_id) DO UPDATE SET
       full_text    = EXCLUDED.full_text,
       word_count   = EXCLUDED.word_count,
       ai_summary   = COALESCE(EXCLUDED.ai_summary, session_transcripts.ai_summary),
       key_topics   = COALESCE(EXCLUDED.key_topics,  session_transcripts.key_topics),
       action_items = COALESCE(EXCLUDED.action_items, session_transcripts.action_items),
       generated_at = NOW()`,
    [
      sessionId,
      fullText,
      wordCount,
      aiSummary ?? null,
      keyTopics ?? null,
      actionItems ?? null,
    ]
  );

  return { fullText, wordCount };
}