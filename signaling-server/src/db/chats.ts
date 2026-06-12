import { queryService } from './client';

export async function saveMessage(data: {
  sessionId: string;
  senderId?: string;
  content: string;
  contentLang?: string;
  translatedContent?: string;
  translatedLang?: string;
  messageType?: string;
}): Promise<{ id: string; sent_at: Date }> {
  const rows = await queryService(
    `INSERT INTO chats
       (session_id, sender_id, content, content_lang,
        translated_content, translated_lang, message_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, sent_at`,
    [
      data.sessionId,
      data.senderId ?? null,
      data.content,
      data.contentLang ?? 'en',
      data.translatedContent ?? null,
      data.translatedLang ?? null,
      data.messageType ?? 'text',
    ]
  );
  return rows[0];
}

export async function getChatsBySession(
  sessionId: string,
  limit = 200,
  before?: Date
) {
  return queryService(
    `SELECT c.id, c.content, c.translated_content, c.translated_lang,
            c.message_type, c.image_url, c.file_url, c.file_name,
            c.sent_at, c.is_deleted,
            u.display_name AS sender_name,
            u.avatar_url   AS sender_avatar
     FROM   chats c
     LEFT JOIN users u ON u.id = c.sender_id
     WHERE  c.session_id = $1
       AND  c.is_deleted = FALSE
       AND  ($3::TIMESTAMPTZ IS NULL OR c.sent_at < $3)
     ORDER  BY c.sent_at DESC
     LIMIT  $2`,
    [sessionId, limit, before ?? null]
  );
}

export async function searchChats(
  userId: string,
  query: string,
  limit = 20
) {
  return queryService(
    `SELECT c.id, c.content, c.sent_at, c.session_id,
            s.host_display_id,
            u.display_name AS sender_name,
            ts_rank(to_tsvector('english', c.content),
                    plainto_tsquery('english', $2)) AS rank
     FROM   chats c
     JOIN   sessions s ON s.id = c.session_id
     LEFT JOIN users u ON u.id = c.sender_id
     WHERE  (s.host_id = $1 OR s.controller_id = $1)
       AND  c.content ILIKE $3
       AND  c.is_deleted = FALSE
     ORDER  BY rank DESC, c.sent_at DESC
     LIMIT  $4`,
    [userId, query, `%${query}%`, limit]
  );
}