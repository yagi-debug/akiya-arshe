export const SERVICE_PREFECTURES = ['大阪府', '兵庫県', '京都府', '奈良県', '滋賀県', '和歌山県'];
export const SERVICE_AREAS_SCHEMA = SERVICE_PREFECTURES.map(name => ({ "@type": "AdministrativeArea", name }));
