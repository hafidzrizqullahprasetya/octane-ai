# Dokumentasi Domain

Panduan bagaimana skill agen harus membaca dan memahami dokumentasi domain ketika menjelajahi basis kode (codebase) ini.

## Sebelum Menjelajah Kode, Baca File Berikut:

- **`CONTEXT.md`** di root repositori, atau
- **`CONTEXT-MAP.md`** di root repositori jika ada (file ini menunjuk ke file `CONTEXT.md` per sub-konteks). Baca yang relevan dengan topik yang dikerjakan.
- **`docs/adr/`**: Baca dokumen Architecture Decision Record (ADR) yang bersinggungan dengan area yang akan diubah.

Jika file-file di atas belum ada, **lanjutkan tanpa perlu komplain**. Jangan tandai ketidakhadirannya sebagai masalah dan jangan membuat file kosong di awal. Skill `/domain-modeling` (dipanggil lewat `/grill-with-docs` dan `/improve-codebase-architecture`) akan membuatnya secara bertahap saat istilah domain atau keputusan arsitektur benar-benar disepakati.

## Struktur File

Repositori konteks tunggal (default untuk sebagian besar repo):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Repositori multi-konteks (jika ada file `CONTEXT-MAP.md` di root):

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← Keputusan di tingkat sistem luas
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← Keputusan spesifik untuk konteks ini
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## Gunakan Istilah dari Glosarium

Saat output Anda menyebutkan konsep domain (dalam judul isu, proposal refaktor, hipotesis, atau nama tes), selalu gunakan istilah resmi yang didefinisikan di `CONTEXT.md`. Hindari menggunakan sinonim lain yang sengaja dihindari oleh glosarium.

Jika konsep yang Anda butuhkan belum ada di glosarium, itu tandanya: Anda mungkin membuat istilah baru yang tidak lazim digunakan di proyek ini, atau memang ada celah konsep yang perlu dicatat untuk skill `/domain-modeling`.

## Laporkan Jika Terjadi Konflik dengan ADR

Jika output atau usulan Anda bertentangan dengan keputusan di ADR yang sudah ada, sampaikan secara eksplisit dan jangan menimpanya diam-diam:

> _Bertentangan dengan ADR-0007 (event-sourced orders), namun perlu dibuka kembali pembahasannya karena…_
