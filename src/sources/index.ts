/**
 * Source registry. Add new adapters here.
 */
import type { BaseSource } from './baseSource';
import { DetikSource } from './detik';
import { KompasSource } from './kompas';
import { CNNIndonesiaSource } from './cnnIndonesia';
import { CNBCIndonesiaSource } from './cnbcIndonesia';
import { TempoSource } from './tempo';
import { AntaraSource } from './antara';
import { Liputan6Source } from './liputan6';
import { KumparanSource } from './kumparan';
import { TribunnewsSource } from './tribunnews';
import { MediaIndonesiaSource } from './mediaIndonesia';
import { RepublikaSource } from './republika';
import { SuaraSource } from './suara';
import { MerdekaSource } from './merdeka';
import { OkezoneSource } from './okezone';
import { VivaSource } from './viva';
import { BisnisIndonesiaSource } from './bisnisIndonesia';

export const ALL_SOURCES: BaseSource[] = [
  new DetikSource(),
  new KompasSource(),
  new CNNIndonesiaSource(),
  new CNBCIndonesiaSource(),
  new TempoSource(),
  new AntaraSource(),
  new Liputan6Source(),
  new KumparanSource(),
  new TribunnewsSource(),
  new MediaIndonesiaSource(),
  new RepublikaSource(),
  new SuaraSource(),
  new MerdekaSource(),
  new OkezoneSource(),
  new VivaSource(),
  new BisnisIndonesiaSource(),
];

export function getSourceByKey(key: string): BaseSource | undefined {
  return ALL_SOURCES.find((s) => s.meta.key === key);
}

export function sourceCredibility(key: string): number {
  return getSourceByKey(key)?.meta.credibility ?? 0.6;
}
