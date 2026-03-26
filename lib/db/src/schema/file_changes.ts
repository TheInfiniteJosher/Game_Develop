import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fileChangesTable = pgTable("file_changes", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  filePath: text("file_path").notNull(),
  previousContent: text("previous_content"),
  newContent: text("new_content").notNull(),
  description: text("description"),
  aiMessageId: text("ai_message_id"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertFileChangeSchema = createInsertSchema(fileChangesTable).omit({
  timestamp: true,
});
export type InsertFileChange = z.infer<typeof insertFileChangeSchema>;
export type FileChange = typeof fileChangesTable.$inferSelect;
