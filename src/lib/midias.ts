import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import type { MidiaItemTipo } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

function storagePath(obraId: string, itemTipo: MidiaItemTipo, itemId: string, ext: string): string {
  return `obras/${obraId}/${itemTipo}/${itemId}/${Date.now()}.${ext}`;
}

// URL pública de um arquivo no bucket "midias" a partir do storage_path.
export function midiaPublicUrl(path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/midias/${path}`;
}

// Uses FormData + direct REST fetch, which works reliably in React Native
// (the supabase-js client's fetch→blob approach fails on some devices)
export async function uploadMidiaAsset(
  obraId: string,
  itemTipo: MidiaItemTipo,
  itemId: string,
  asset: ImagePicker.ImagePickerAsset,
  uploadedPor: string | null,
): Promise<void> {
  const ext = asset.uri.split('.').pop()?.toLowerCase() ?? (asset.type === 'video' ? 'mp4' : 'jpg');
  const path = storagePath(obraId, itemTipo, itemId, ext);

  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName ?? `upload.${ext}`,
    type: asset.mimeType ?? 'image/jpeg',
  } as any);

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? '';

  const resp = await fetch(`${supabaseUrl}/storage/v1/object/midias/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'x-upsert': 'false' },
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: 'Erro no upload' }));
    throw new Error((err as { message?: string }).message ?? 'Erro no upload');
  }

  const { error: dbError } = await supabase.from('midias').insert({
    obra_id: obraId,
    item_tipo: itemTipo,
    item_id: itemId,
    storage_path: path,
    tipo: asset.type === 'video' ? 'video' : 'foto',
    nome_original: asset.fileName ?? null,
    tamanho_bytes: asset.fileSize ?? null,
    uploaded_por: uploadedPor,
  });

  if (dbError) {
    await supabase.storage.from('midias').remove([path]);
    throw dbError;
  }
}

// Sobe uma foto do RDO pro bucket "midias" em obras/{obraId}/rdo/...
// (caminho exigido pela policy de storage). Retorna a URL pública.
export async function uploadRdoFoto(
  obraId: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<string> {
  const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `obras/${obraId}/rdo/${Date.now()}.${ext}`;

  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName ?? `rdo.${ext}`,
    type: asset.mimeType ?? 'image/jpeg',
  } as any);

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? '';

  const resp = await fetch(`${supabaseUrl}/storage/v1/object/midias/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'x-upsert': 'false' },
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: 'Erro no upload' }));
    throw new Error((err as { message?: string }).message ?? 'Erro no upload da foto');
  }

  return `${supabaseUrl}/storage/v1/object/public/midias/${path}`;
}

export async function uploadAvatar(
  authUserId: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<string> {
  const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${authUserId}/avatar.${ext}`;

  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: `avatar.${ext}`,
    type: asset.mimeType ?? 'image/jpeg',
  } as any);

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? '';

  const resp = await fetch(`${supabaseUrl}/storage/v1/object/avatares/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'x-upsert': 'true' },
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: 'Erro no upload do avatar' }));
    throw new Error((err as { message?: string }).message ?? 'Erro no upload do avatar');
  }

  return `${supabaseUrl}/storage/v1/object/public/avatares/${path}`;
}

export async function uploadPortfolioFoto(
  authUserId: string,
  pessoaId: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<{ url: string; storagePath: string }> {
  const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const fileName = `${Date.now()}.${ext}`;
  const path = `${authUserId}/${fileName}`;

  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: fileName,
    type: asset.mimeType ?? 'image/jpeg',
  } as any);

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? '';

  const resp = await fetch(`${supabaseUrl}/storage/v1/object/portfolio/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'x-upsert': 'false' },
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: 'Erro no upload' }));
    throw new Error((err as { message?: string }).message ?? 'Erro no upload da foto');
  }

  const url = `${supabaseUrl}/storage/v1/object/public/portfolio/${path}`;

  const { error: dbError } = await supabase.from('portfolio_fotos').insert({
    pessoa_id: pessoaId,
    storage_path: path,
    url,
  });

  if (dbError) {
    await supabase.storage.from('portfolio').remove([path]);
    throw new Error(dbError.message);
  }

  return { url, storagePath: path };
}
