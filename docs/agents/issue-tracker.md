# Issue Tracker: GitHub

Semua isu, tiket tugas, dan spesifikasi fitur untuk repo ini dikelola melalui GitHub Issues. Gunakan CLI `gh` untuk seluruh operasi pelacakan.

## Konvensi Penggunaan

- **Membuat isu baru**: `gh issue create --title "..." --body "..."`. Gunakan heredoc untuk deskripsi multi-baris.
- **Membaca isu**: `gh issue view <nomor> --comments`, memfilter komentar dengan `jq` serta mengambil label.
- **Melihat daftar isu terbuka**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` dengan filter `--label` dan `--state` yang relevan.
- **Memberi komentar pada isu**: `gh issue comment <nomor> --body "..."`
- **Menambah / menghapus label**: `gh issue edit <nomor> --add-label "..."` / `--remove-label "..."`
- **Menutup isu**: `gh issue close <nomor> --comment "..."`

Repo target dideteksi otomatis dari `git remote -v` saat perintah dijalankan di dalam clone repo ini.

## Pull Request sebagai Target Triage

**PRs as a request surface: no.** _(Ubah ke `yes` jika repo ini memperlakukan PR eksternal sebagai tiket permintaan fitur; skill `/triage` membaca opsi ini.)_

Jika diatur ke `yes`, alur PR akan diperlakukan sama seperti issue menggunakan perintah `gh pr`:

- **Membaca PR**: `gh pr view <nomor> --comments` dan `gh pr diff <nomor>` untuk melihat perubahan kode.
- **Daftar PR eksternal untuk triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`, kemudian filter hanya yang memiliki `authorAssociation` bernilai `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, atau `NONE`.
- **Komentar / label / tutup**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub berbagi ruang nomor yang sama antara isu dan PR. Jika hanya berupa nomor `#42`, periksa terlebih dahulu dengan `gh pr view 42`, jika gagal beralih ke `gh issue view 42`.

## Saat Skill Menginstruksikan "publish to the issue tracker"

Buat sebuah GitHub Issue baru.

## Saat Skill Menginstruksikan "fetch the relevant ticket"

Jalankan `gh issue view <nomor> --comments`.

## Operasi Wayfinding (Pemetaan Proyek)

Digunakan oleh skill `/wayfinder`. Peta utama (**map**) adalah satu issue induk, dan tiket turunannya (**child**) adalah sub-issue/sub-tiket.

- **Map (Peta)**: Satu isu berlabel `wayfinder:map`, berisi Catatan / Keputusan / Bagian yang belum jelas (Fog). Dibuat via `gh issue create --label wayfinder:map`.
- **Child ticket (Tiket Anak)**: Isu yang dihubungkan ke map sebagai sub-issue GitHub (`gh api` pada endpoint sub-issues). Jika sub-issues tidak aktif, cantumkan tiket di daftar tugas (task list) pada body map dan tambahkan `Part of #<map>` di baris paling atas body tiket anak. Beri label `wayfinder:<tipe>` (`research`/`prototype`/`grilling`/`task`). Saat diklaim, tetapkan penanggung jawab tiket ke dev yang aktif.
- **Blocking (Ketergantungan)**: Menggunakan fitur dependensi isu bawaan GitHub. Tambahkan relasi blokir via `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` (menggunakan numeric database id `gh api repos/<owner>/<repo>/issues/<n> --jq .id`). Jika fitur dependensi tidak tersedia, gunakan format teks `Blocked by: #<n>, #<n>` di baris atas body tiket anak. Tiket dianggap tidak terblokir jika semua isu pemblokirnya telah ditutup.
- **Frontier query**: Ambil daftar tiket anak yang masih terbuka (`gh issue list --state open`), abaikan yang masih terblokir atau sudah memiliki assignee; tiket pertama yang siap dikerjakan menjadi prioritas.
- **Claim**: Jalankan `gh issue edit <n> --add-assignee @me` sebelum mulai bekerja.
- **Resolve**: Tulis jawaban `gh issue comment <n> --body "<jawaban>"`, lalu tutup tiket `gh issue close <n>`, dan tautkan ringkasannya ke bagian keputusan di tiket map utama.
