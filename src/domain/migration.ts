/** 주소 이사: 옛 주소의 저장 데이터를 새 주소로 넘기는 글 꾸러미 (순수 함수, 화면 없음) */
import { exportBackup, parseBackup } from './shareCode';

/** 새 주소가 받는 길 — `#/migrate/<꾸러미>` */
export const MIGRATE_ROUTE = '/migrate';

const GZIP = 'g.';
const PLAIN = 'p.';

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** 저장 데이터를 주소에 실을 수 있는 글로 만든다 (백업 파일과 같은 모양을 압축). 압축을 못 하는 브라우저는 그대로 싣는다 */
export async function encodeMigration(save: object, now: number): Promise<string> {
  const bytes = new TextEncoder().encode(exportBackup(save, now));
  if (typeof CompressionStream === 'undefined') return PLAIN + toBase64Url(bytes);
  return GZIP + toBase64Url(await pipe(bytes, new CompressionStream('gzip')));
}

/** 꾸러미를 풀어 백업 글로 돌려준다. 깨졌으면 null */
export async function decodeMigration(payload: string): Promise<string | null> {
  try {
    const bytes = fromBase64Url(payload.slice(2));
    if (payload.startsWith(PLAIN)) return new TextDecoder().decode(bytes);
    if (payload.startsWith(GZIP) && typeof DecompressionStream !== 'undefined') {
      return new TextDecoder().decode(await pipe(bytes, new DecompressionStream('gzip')));
    }
  } catch {
    /* 아래에서 null */
  }
  return null;
}

/** 꾸러미를 풀고 백업 모양까지 확인한다. 하나라도 어긋나면 아무것도 바꾸지 않도록 오류를 돌려준다 */
export async function readMigration(payload: string) {
  const text = await decodeMigration(payload);
  if (text === null) return { ok: false as const, error: '넘어온 데이터를 읽을 수 없어요.' };
  return parseBackup(text);
}

/** 새 주소로 보낼 전체 주소. 꾸러미는 `#` 뒤라서 서버로 보내지지 않는다 */
export function migrationUrl(newSite: string, payload: string): string {
  return `${newSite.replace(/\/+$/, '')}/#${MIGRATE_ROUTE}/${payload}`;
}
