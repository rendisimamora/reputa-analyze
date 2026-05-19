/**
 * Re-run sentiment analysis on mentions that haven't been analyzed yet.
 * Useful when:
 *   - OpenAI was rate-limited / unavailable during the original scan
 *   - User updated their OPENAI_API_KEY after scan
 *   - User wants to re-process after changing the analyzer prompt
 */
import { pLimit } from '@/lib/pLimit';
import { prisma } from '@/lib/prisma';
import { analyzeSentiment } from './sentimentAnalyzer';
import { computeReputation } from './reputationScore';
import { evaluateAlerts } from './alertEngine';

export interface ReanalyzeResult {
  total: number;
  analyzed: number;
  errors: number;
  firstError?: string;
  score: number | null;
}

export async function reanalyzeProject(projectId: string): Promise<ReanalyzeResult> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  const pending = await prisma.mention.findMany({
    where: { projectId, analyzedAt: null, crawlStatus: { in: ['OK', 'PARTIAL'] } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  let analyzed = 0;
  let errors = 0;
  let firstError: string | undefined;
  const limit = pLimit(3);

  await Promise.all(
    pending.map((m) =>
      limit(async () => {
        try {
          const result = await analyzeSentiment({
            subject: project.name,
            title: m.title,
            snippet: m.snippet,
            rawContent: m.rawContent,
            source: m.sourceName,
            publishedAt: m.publishedAt,
          });
          await prisma.mention.update({
            where: { id: m.id },
            data: {
              sentiment: result.sentiment,
              sentimentScore: result.sentimentScore,
              emotion: result.emotion,
              toxicity: result.toxicity,
              hateSpeech: result.hateSpeech,
              fakeNews: result.fakeNews,
              topic: result.topic,
              aiSummary: result.summary,
              analyzedAt: new Date(),
            },
          });
          analyzed++;
        } catch (err) {
          errors++;
          const msg = err instanceof Error ? err.message : String(err);
          if (!firstError) firstError = msg;
          console.error(`[reanalyze] mention ${m.id} FAILED:`, msg);
        }
      }),
    ),
  );

  // Recompute reputation + re-evaluate alerts
  const all = await prisma.mention.findMany({ where: { projectId } });
  const rep = computeReputation(all);
  await evaluateAlerts(projectId, rep.score);
  await prisma.project.update({
    where: { id: projectId },
    data: { lastScanAt: new Date() },
  });

  return {
    total: pending.length,
    analyzed,
    errors,
    firstError,
    score: rep.score,
  };
}
