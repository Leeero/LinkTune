import type { CustomCredentials } from './types';
import type { CustomPlatform, CustomSong } from './library';
import { parseCustomSong } from './library';

/**
 * 方法下发 API 返回的配置结构
 */
type MethodConfig = {
  type: 'http';
  method: 'GET' | 'POST';
  url: string;
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  transform?: string;
};

type MethodApiResponse = {
  code: number;
  data?: MethodConfig;
  message?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object';
}

/**
 * 从响应中提取列表数据
 */
function extractList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  // 尝试常见的响应格式
  const data = payload.data;
  if (Array.isArray(data)) return data;

  if (isRecord(data)) {
    const list = data.list;
    if (Array.isArray(list)) return list;

    // 酷我格式
    const abslist = data.abslist;
    if (Array.isArray(abslist)) return abslist;
  }

  const list = payload.list;
  if (Array.isArray(list)) return list;

  // 网易云搜索格式
  const result = payload.result;
  if (isRecord(result)) {
    const songs = result.songs;
    if (Array.isArray(songs)) return songs;
  }

  return [];
}

/**
 * 获取方法配置
 */
async function getMethodConfig(params: {
  credentials: CustomCredentials;
  platform: CustomPlatform;
  functionName: string;
  signal?: AbortSignal;
}): Promise<MethodConfig> {
  const { credentials, platform, functionName, signal } = params;

  const res = await fetch(`${credentials.baseUrl}/v1/methods/${platform}/${functionName}`, {
    method: 'GET',
    headers: {
      'X-API-Key': credentials.apiKey,
      Accept: 'application/json',
    },
    signal,
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('API Key 无效或未提供');
    }
    if (res.status === 404) {
      throw new Error(`平台 ${platform} 不支持 ${functionName} 功能`);
    }
    throw new Error(`获取方法配置失败: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as MethodApiResponse;

  if (json.code !== 0 || !json.data) {
    throw new Error(json.message || '获取方法配置失败');
  }

  return json.data;
}

/**
 * 执行模板表达式
 * 支持 {{id}}, {{parseInt(id)}}, {{id.toString()}} 等形式
 */
function evaluateTemplateExpr(
  expr: string,
  vars: Record<string, string | number>,
): string | number {
  try {
    // 创建一个包含变量的执行环境
    const varNames = Object.keys(vars);
    const varValues = Object.values(vars);
    
    // 构建函数体，注入所有变量
    const fn = new Function(...varNames, `return ${expr}`);
    const result = fn(...varValues);
    return result;
  } catch (e) {
    // 如果执行失败，打印错误信息并返回空字符串
    console.warn('模板表达式执行失败:', expr, '错误:', e);
    return '';
  }
}

/**
 * 替换模板变量
 * 支持简单变量 {{id}} 和表达式 {{parseInt(id)}}
 */
function replaceTemplateVars(
  template: string,
  vars: Record<string, string | number>,
): string {
  // 匹配 {{...}} 模式
  // 使用非贪婪匹配，确保正确匹配嵌套括号的表达式
  return template.replace(/\{\{(.+?)\}\}/g, (match, expr: string) => {
    const trimmedExpr = expr.trim();
    // 如果是简单变量名，直接替换
    if (trimmedExpr in vars) {
      return String(vars[trimmedExpr]);
    }
    // 否则尝试执行表达式
    const result = evaluateTemplateExpr(trimmedExpr, vars);
    // 如果结果仍然是模板格式，说明执行失败了
    if (typeof result === 'string' && result.startsWith('{{')) {
      console.warn('模板表达式执行失败:', trimmedExpr, '变量:', vars);
      return '';  // 返回空字符串而不是原始模板
    }
    return String(result);
  });
}

/**
 * 替换单个模板值，保留类型（数字/字符串）
 * 如果整个字符串就是一个模板表达式，保留其原始类型
 */
function replaceTemplateValue(
  value: string,
  vars: Record<string, string | number>,
): string | number {
  // 检查是否整个字符串就是一个模板表达式 {{...}}
  const match = value.match(/^\{\{(.+?)\}\}$/);
  if (match) {
    const expr = match[1].trim();
    // 如果是简单变量名
    if (expr in vars) {
      return vars[expr];
    }
    // 执行表达式，保留原始类型
    return evaluateTemplateExpr(expr, vars);
  }
  // 否则按字符串处理
  return replaceTemplateVars(value, vars);
}

/**
 * 深度替换对象中的模板变量
 * 支持保留数值类型（当整个值是模板表达式时）
 */
function replaceTemplateVarsDeep(
  obj: Record<string, unknown>,
  vars: Record<string, string | number>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = replaceTemplateValue(value, vars);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = replaceTemplateVarsDeep(value as Record<string, unknown>, vars);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 安全执行 transform 函数
 * 服务端返回的 transform 是字符串形式的函数，需要安全执行
 */
function executeTransform(transformStr: string, response: unknown): unknown {
  try {
    // 创建一个安全的函数执行环境
     
    const transformFn = new Function('return ' + transformStr)();
    if (typeof transformFn === 'function') {
      return transformFn(response);
    }
  } catch (e) {
    console.warn('Transform 执行失败:', e);
  }
  return response;
}

/**
 * 执行方法配置请求（直接调用第三方 API）
 * 注意：在浏览器环境可能遇到 CORS 问题，但在 Electron/Capacitor 原生环境中可正常工作
 */
async function executeMethodConfig(params: {
  config: MethodConfig;
  vars?: Record<string, string | number>;
  signal?: AbortSignal;
}): Promise<unknown> {
  const { config, vars = {}, signal } = params;

  // 替换 URL 中的模板变量
  let url = replaceTemplateVars(config.url, vars);

  // 构建查询参数
  if (config.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(config.params)) {
      const replaced = replaceTemplateVars(value, vars);
      if (replaced) {
        searchParams.set(key, replaced);
      }
    }
    const paramStr = searchParams.toString();
    if (paramStr) {
      url += (url.includes('?') ? '&' : '?') + paramStr;
    }
  }

  // 构建请求体
  let body: string | undefined;
  if (config.method === 'POST' && config.body) {
    const bodyObj = replaceTemplateVarsDeep(config.body, vars);
    body = JSON.stringify(bodyObj);
  }

  const res = await fetch(url, {
    method: config.method,
    headers: {
      ...config.headers,
      Accept: 'application/json',
    },
    body,
    signal,
  });

  if (!res.ok) {
    throw new Error(`请求失败: ${res.status} ${res.statusText}`);
  }

  let response = await res.json();

  // 如果有 transform 函数，执行转换
  if (config.transform) {
    response = executeTransform(config.transform, response);
  }

  return response;
}

export type SearchResult = {
  songs: CustomSong[];
  total: number;
};

/**
 * 搜索歌曲
 */
export async function customSearchSongs(params: {
  credentials: CustomCredentials;
  platform: CustomPlatform;
  keyword: string;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<SearchResult> {
  const { credentials, platform, keyword, page = 1, pageSize = 30, signal } = params;

  // 获取方法配置
  const config = await getMethodConfig({
    credentials,
    platform,
    functionName: 'search',
    signal,
  });

  // 执行请求（Electron/Capacitor 环境下直接调用，已配置 CORS 代理）
  // 注意：服务端模板使用 limit 而不是 pageSize
  const json = await executeMethodConfig({
    config,
    vars: {
      keyword,
      page,
      limit: pageSize,
      pageSize,
    },
    signal,
  });

  const list = extractList(json);
  const songs = list.map((item) => parseCustomSong(item, platform)).filter((x) => Boolean(x.id));

  // 尝试提取总数
  let total = songs.length;
  if (isRecord(json)) {
    if (typeof json.total === 'number') {
      total = json.total;
    } else if (isRecord(json.data) && typeof json.data.total === 'number') {
      total = json.data.total;
    } else if (isRecord(json.result) && typeof json.result.songCount === 'number') {
      total = json.result.songCount;
    }
  }

  return { songs, total };
}
