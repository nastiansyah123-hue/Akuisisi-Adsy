# Akuisisi Adsy Team — laporan CS & advertiser

React + Vite untuk Vercel, Supabase Auth + Postgres. Bahasa Indonesia, responsif, ekspor CSV. Tanpa env Supabase, mode demo menyimpan data sintetis di localStorage; bukan impor angka workbook.

## Menjalankan dan menguji

```sh
npm ci
npm run dev
npm test
npm run test:db
npm run build
```

Tes aplikasi mencakup paket, omzet, filter, pajak dan koreksi. Tes PGlite menjalankan skema PostgreSQL, migrasi, snapshot, RLS, pemalsuan angka, pembatalan/pemulihan admin, serta permintaan koreksi ganda/stale. Build menghasilkan `dist`. Pemeriksaan browser belum tersedia pada lingkungan pembuatan.

## Alur utama

1. Admin menambahkan produk dan satuan (botol/box), lalu paket penjualan. Setiap paket memiliki nama, jumlah unit, **harga total paket**, jenis reguler/reseller, dan status aktif.
2. Admin menugaskan CS → produk → advertiser → channel.
3. CS memilih tanggal/penugasan lalu mengisi **leads dan jumlah order per paket**. Satu order paket = satu closing. Total closing, unit, dan omzet dihitung otomatis; CS tidak mengisi harga, omzet atau pembatalan.
4. Advertiser mengisi total biaya iklan harian per produk/channel dan pajak. Dashboard advertiser membuka form biaya iklan.
5. Admin membuka **Laporan CS → Koreksi**, memilih paket dan jumlah order yang tidak valid, serta memberi alasan wajib. Pemulihan tersedia jika salah membatalkan. Riwayat tidak dihapus, termasuk siapa dan kapan. CS/advertiser melihat rincian serta riwayat sesuai hak akses, tanpa tombol koreksi.
6. Laporan pertama disimpan terpisah (`originalPackageLines`, `originalLeads`). Edit jumlah order oleh CS tidak menghapus snapshot pertama atau riwayat koreksi. CS tidak bisa menurunkan order di bawah jumlah yang telah dibatalkan admin.

Satu laporan per tanggal/CS/produk/advertiser/channel. Satu biaya per tanggal/produk/advertiser/channel. Gunakan Edit untuk revisi; identitas dan tanggal laporan tersimpan tidak bisa dipindahkan. Nonaktifkan penugasan/paket untuk menghentikan pemakaian baru tanpa menghapus sejarah.

## Contoh perhitungan

Paket 1 botol Rp10.000 × 5 order, paket 2 botol Rp15.000 × 3 order, paket 3 botol Rp20.000 × 2 order: **10 closing, 17 botol, omzet Rp135.000**. Harga paket dua botol tidak dikalikan dua lagi.

Pembatalan admin satu order paket 2 botol: hasil bersih **9 closing, 15 botol, Rp120.000**. Laporan awal tetap 10 order dan riwayat alasan tersimpan. Pulihkan satu pembatalan untuk mengembalikan hasil semula.

- Closing awal = total order semua paket; closing bersih = total order − pembatalan.
- Unit awal = Σ(order × isi paket); unit bersih = Σ((order − batal) × isi paket).
- Omzet = Σ((order − batal) × harga total paket), dibulatkan dua desimal.
- Closing rate = closing bersih / leads; CAC = biaya termasuk pajak / closing bersih.
- Biaya iklan termasuk pajak = budget × (1 + pajak/100). Biaya tidak dikalikan jumlah CS.
- Paket reseller adalah paket tersendiri dengan harga total dan isi yang ditetapkan admin.

Nama, isi, jenis dan harga paket disalin ke laporan saat pertama digunakan. Perubahan paket di master berlaku untuk penggunaan baru; laporan yang sudah menyimpan paket tetap memakai snapshot lama. Tambahan paket aktif muncul otomatis dalam form baru dan saat mengedit laporan paket. Paket lama dalam laporan tidak bisa dihapus, namun ordernya bisa diubah sampai batas pembatalan admin.

## Filter

Pemilih produk di sidebar berlaku di seluruh dashboard, laporan, biaya, penugasan, data produk admin, ekspor serta form penugasan. Pilih Semua produk untuk gabungan. CS/advertiser hanya mendapat pilihan dari data berhak akses. Kalender menyediakan rentang inklusif, preset hari/bulan dan Terapkan/Batal. Hari ini/Kemarin menggunakan Asia/Jakarta (WIB).

## GitHub → Vercel → Supabase

1. Buat proyek Supabase baru. Jalankan `supabase/schema.sql` **sekali**; sudah termasuk migrasi 002, 003, 004, 005, dan 006. Jangan jalankan file migrasi yang sama lagi pada proyek baru.
2. Buat akun admin pertama melalui Authentication → Users tanpa metadata pendaftaran publik. Tambahkan profil admin untuk UUID tersebut. CS/advertiser mendaftar lewat UI dan harus diaktifkan admin:

```sql
insert into public.profiles (id,name,role)
values ('UUID-AUTH-USER','Admin','admin');
```

Peran: `admin`, `cs`, `advertiser`. Nama operasional unik dan sama persis dengan nama penugasan. Admin tidak didaftarkan lewat UI publik. CS/advertiser memilih perannya saat Daftar, lalu admin mengaktifkan dan mencocokkan nama operasional melalui Akun tim. Jangan mengganti nama profil aktif yang dipakai histori tanpa migrasi. Aktifkan email signup di Supabase Auth, atur Site URL dan redirect allowlist ke URL produksi, serta konfigurasi konfirmasi email/SMTP sesuai kebutuhan.

3. Push source ke GitHub privat, import ke Vercel (preset Vite, build `npm run build`, output `dist`). Jangan commit `.env`.
4. Tambahkan env Vercel lalu deploy:

```text
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=PUBLIC-ANON-OR-PUBLISHABLE-KEY
```

Untuk lokal salin `.env.example` ke `.env.local`. **Jangan gunakan service_role key di frontend**. Public key dilindungi kebijakan RLS dan trigger database. Setelah env tersedia login wajib; pilihan simulasi peran hilang. Data demo tidak diimpor otomatis. Data tim diperbarui saat login/refresh, belum realtime.

5. Uji akun admin, CS, advertiser pada proyek Supabase nyata sebelum tim memakainya. Skema diuji di PostgreSQL lokal PGlite, belum di proyek Supabase pengguna.

## Upgrade database dan laporan lama

- Database sebelum fitur Data produk: jalankan `002_product_pricing.sql`, `003_order_packages.sql`, lalu `004_lead_reports.sql` dan `005_unified_daily_report.sql`, masing-masing satu kali.
- Database yang sudah memiliki Data produk/harga satuan: jalankan `003_order_packages.sql` lalu `004_lead_reports.sql` dan `005_unified_daily_report.sql`, masing-masing satu kali.
- Proyek baru: jalankan `schema.sql` saja.

Migrasi 002 memakai box sebagai placeholder satuan produk lama; sesuaikan pemetaan satuan sebelum dijalankan jika perlu. Migrasi 003 membuat paket reguler/reseller satu unit dari harga lama yang positif. Admin bisa mengatur paket berikutnya melalui UI.

Laporan agregat lama tidak punya rincian order per paket, sehingga disimpan sebagai **arsip baca saja**. Omzet dan jumlah sebelumnya tidak diubah; tidak ditebak menjadi paket. Laporan baru harus menggunakan format paket. Hal yang sama berlaku untuk data demo browser lama. Jika tanggal/penugasan sudah memiliki arsip, gunakan tanggal/penugasan lain untuk mencoba input baru. Harga dan paket demo hanya contoh, bukan harga resmi bisnis.

## Aturan database

- RLS membatasi laporan CS sendiri, hasil advertiser sendiri, serta akses penuh admin.
- Trigger membangun snapshot dari master atau laporan lama, menghitung semua total, dan mengabaikan harga, pembatalan, total, serta snapshot awal yang dipalsukan klien.
- Pembatalan hanya lewat RPC `correct_package`, memeriksa peran admin, alasan, batas jumlah dan jumlah pembatalan terakhir. Penguncian baris membuat pembatalan serta rekap atomik. Permintaan stale ditolak; muat ulang jika data diubah admin lain.
- Tabel `packageCorrections` hanya dibaca sesuai hak laporan; tidak ada izin insert/update/delete langsung. Riwayat actor/tanggal/alasan disimpan. `audit_log` mencatat perubahan laporan/master dan hanya dapat dibaca admin.

## Batas saat ini

Belum mengimpor workbook 83 tab, mencatat order/pelanggan satu per satu, memisahkan email/WhatsApp, memberi approval semua laporan, diskon reseller otomatis menurut ambang volume, target/grade KPI, top up, manajemen akun lengkap di luar aktivasi/penolakan pendaftaran, reset password, atau API platform iklan. Pembatalan berdasarkan jumlah order per paket, bukan identitas order. Sepakati tarif/definisi bisnis, strategi impor dan backup sebelum produksi.

Source siap GitHub/Vercel/Supabase; belum terhubung ke akun layanan pengguna. Demo dipublikasikan terpisah melalui Sites.

## Filter nama untuk admin

Dashboard admin menyediakan filter CS di sebelah channel dan filter advertiser. Pilihan mengubah angka, grafik, performa, laporan CS dan ekspor, bersama produk/tanggal/channel. Pada biaya iklan, filter advertiser berlaku; filter CS tidak ditampilkan karena biaya belum dicatat per CS. Saat dashboard difilter satu CS, biaya/CAC dikosongkan dan grafik hanya menunjukkan omzet; biaya per advertiser/produk adalah gabungan sehingga tidak dialokasikan ke satu CS secara sembarang. Pilih Semua CS untuk biaya/CAC gabungan. Admin tidak memiliki tombol input laporan CS; admin melihat rincian serta melakukan koreksi. Input laporan milik CS, sedangkan biaya iklan milik advertiser.

## Kartu dashboard per peran

Admin dan advertiser: omzet, biaya iklan termasuk pajak, closing bersih, closing rate, CAQ. CAQ = biaya termasuk pajak / omzet, dalam persen. Saat admin memilih satu CS, CAQ tidak tersedia karena biaya belum dialokasikan per CS.

CS: omzet, jumlah leads (menggantikan biaya iklan), closing bersih, closing rate, Upsell. Upsell = unit bersih / closing bersih, ditampilkan sebagai rata-rata unit per closing, bukan persentase order upsell. Semua kartu mengikuti filter periode/produk/channel/nama yang aktif, serta pembatalan/pemulihan admin. Pembagi nol ditampilkan —.

## Tampilan mobile

Pada lebar hingga 700px, navigasi menjadi drawer dengan overlay/tombol tutup/Escape, filter menjadi dua kolom, statistik dua kolom dengan kartu terakhir selebar layar, dan tabel diubah menjadi kartu berlabel. Form menjadi panel bawah satu kolom dengan input 16px agar tidak memicu zoom otomatis iOS. Kalender memakai preset horizontal dan tombol sentuh lebih besar; area aman perangkat dan tinggi viewport dinamis diperhitungkan. Di desktop tabel tetap tabel. Tes render memastikan label mobile mengikuti kolom kondisional; pemeriksaan visual browser/perangkat belum tersedia dalam lingkungan ini.

## Report Lead dan menu bawah HP

Menu mobile tetap di bawah: Ringkasan, Laporan CS, Report Lead, Iklan (sesuai peran), dan Lainnya. Lainnya membuka produk, penugasan, dan menu admin. Navigasi desktop tetap di sidebar. Area aman home indicator dan jarak konten diperhitungkan.

CS mengisi Report Lead BEF pada tab di modul Input laporan CS. Shortcut pada halaman rekap membuka modul yang sama; tanggal dan penugasan tidak dipilih ulang. Kategori: Pasif, Konsultasi, Harga/Ongkir, OOC, Lead iseng, Beli Di Lain, Lainnya. Sesuai keputusan pengguna, **satu lead hanya masuk satu kategori**: jumlah kategori harus bilangan bulat nonnegatif dan totalnya tidak melebihi leads laporan harian. Input boleh parsial; sisa ditampilkan sebagai belum dikategorikan. Ini laporan jumlah agregat, sehingga pencegahan orang yang sama tercatat dua kali di lapangan tetap perlu proses tim; aplikasi tidak menyimpan identitas lead individual.

Satu Report Lead per laporan harian. CS hanya bisa mengisi/edit miliknya; admin dan advertiser membaca sesuai akses. Kategori mengikuti filter tanggal/produk/channel/nama dan tersedia di CSV. Penyimpanan tidak mengubah closing/omzet. Jumlah leads pada laporan CS tidak boleh diturunkan di bawah total kategori; kurangi klasifikasinya terlebih dahulu. Perubahan tercatat dalam audit admin.

Database yang sudah menjalankan migrasi 003 menjalankan `004_lead_reports.sql` lalu `005_unified_daily_report.sql`, masing-masing sekali. Proyek baru tetap memakai schema.sql lengkap. Data demo lama dipertahankan, dengan kategori kosong sampai CS mengisinya.

## Form Input laporan CS terpadu (versi terbaru)

Tanggal dan penugasan dipilih sekali di bagian atas. Di bawahnya, sebelum Jumlah leads, ada tab **Total Order** dan **Report Lead BEF**. Jumlah leads dipakai bersama, isian order/kategori tetap ada saat pindah tab, dan satu tombol menyimpan keduanya. Menu Report Lead BEF tetap berfungsi sebagai rekap dengan kartu kategori dan filter; tombol editnya membuka modul Input laporan CS pada tab BEF, tanpa pemilih laporan tambahan.

RPC `save_cs_daily_report` menyimpan order dan kategori dalam satu transaksi; jika salah satunya gagal, keduanya dibatalkan. Leads dan kategori dapat diturunkan bersamaan atau dinaikkan bersamaan tanpa berbenturan dengan guard lama. Identitas, snapshot harga, serta hak akses tetap diperiksa. Arsip format order lama tetap tidak diubah; tab BEF-nya bisa disimpan terpisah pada identitas yang sama.

Database yang sudah menjalankan migrasi 004 cukup menjalankan **005_unified_daily_report.sql** sekali. Proyek baru menggunakan schema.sql lengkap.

## Merek dan warna

Nama aplikasi: Akuisisi Adsy Team. Tema navy #073B56, cyan #00A8DF, kuning #FFD12A, putih kebiruan #F4F9FC, dan kartu putih. Tombol memakai biru lebih gelap #00789F agar teks putih tetap terbaca. Logo asli pengguna tersedia di public/adsy-logo.png (PNG transparan 32 × 32), dipakai pada merek/sidebar/login dan favicon tanpa mengubah file aslinya. Hijau dan merah dipertahankan untuk status berhasil/error. Grafik serta navigasi mobile mengikuti tema.

## Sidebar dan pagination

Desktop memiliki satu tombol ikon ciutkan/buka di sebelah merek Akuisisi Adsy Team pada sidebar, tanpa tulisan tombol dan tanpa duplikasi di header. Mode ringkas menampilkan ikon dengan tooltip dan menyimpan preferensi di browser. Navigasi bawah HP tetap tersedia. Laporan CS dan advertiser memakai pagination 10/25/50 baris, nomor halaman, sebelumnya/berikutnya, jumlah hasil, dan reset saat filter berubah. Ekspor tetap mencakup semua hasil filter. Pengambilan data Supabase dilakukan bertahap 500 baris agar daftar tidak terpotong batas default API; pagination tampilan berjalan di browser setelah data berhak akses dimuat.

Logo resmi telah dipasang dari ZIP unggahan pengguna. Source ZIP menyertakan aset PNG asli agar ikut terdeploy di Vercel.

## Aset logo

`public/adsy-logo.png` berasal dari file logo-adsy.png dalam ZIP pengguna, tanpa mengubah byte gambar. Ukuran asli 32 × 32 dipertahankan dalam tampilan merek untuk menghindari pembesaran yang pecah. Ikon tab browser memakai PNG yang sama.

## Pendaftaran CS dan Advertiser (006)

Halaman Masuk/Daftar menyediakan nama, email, password minimal 8 karakter, serta pilihan CS/Advertiser. Tidak ada pilihan admin. Trigger Auth menolak peran admin dari metadata pendaftaran publik. Akun manual tanpa metadata tetap dapat diprovisikan pemilik proyek, misalnya admin awal.

Profil pendaftar baru berstatus pending dan memakai nama internal unik sampai ditinjau admin. Nama yang dimasukkan tidak langsung memberi akses ke laporan lama dengan nama yang sama. Helper RLS hanya mengembalikan peran/nama untuk status active. Pendaftar tidak dapat mengubah status/peran sendiri. Admin memakai Akun tim untuk meninjau nama/email/peran lalu mengaktifkan atau menolak. Nama operasional yang sudah dimiliki akun lain tidak bisa diklaim lagi. Akun aktif lama tetap aktif setelah migrasi.

Jika konfirmasi email diaktifkan di Supabase, pendaftar perlu mengonfirmasi email sebelum masuk. Setelah admin aktifkan, pilih Periksa status terbaru atau masuk ulang. Atur Site URL/redirect URL di Supabase ke URL deployment yang benar agar link email tidak mengarah ke localhost. Jangan mengirim password melalui chat.

Database yang sudah sampai 005 menjalankan **006_team_registration.sql** sekali. Untuk database lebih lama, jalankan migrasi yang belum diterapkan secara berurutan sampai 006. Proyek baru cukup schema.sql. Aktifkan email signup di pengaturan Auth (menggantikan petunjuk versi lama yang menonaktifkannya).

Demo tanpa konfigurasi Supabase hanya menampilkan pratinjau halaman akun lewat Masuk / Daftar; tombol kirim dinonaktifkan dan tidak membuat akun palsu. Preview dapat ditutup dengan Kembali ke demo.

Logo PNG asli kini tampil tanpa latar putih, border, atau garis dekoratif tambahan dari CSS; bentuk gambar asli 32 × 32 dipertahankan.

Sidebar dapat digulir secara terpisah pada desktop maupun HP, termasuk layar pendek/zoom browser. Anak flex tidak menyusut sehingga menu bawah tetap dapat dijangkau; mendukung roda mouse, sentuhan, dan fokus keyboard.

## Header ringkas dan pesan semangat

Header atas diperkecil menjadi 60px desktop/52px HP. Judul dashboard diganti kumpulan pesan semangat berbahasa Indonesia yang disusun AI pada saat pengembangan, berganti tiap 60 detik ketika tab terlihat. Tombol berikutnya dan jeda tersedia. Pesan contoh tetap tersedia ketika backend OpenAI belum aktif. Versi terbaru mendukung generasi OpenAI langsung melalui backend Vercel; lihat konfigurasi di bawah.

## Pesan semangat OpenAI melalui Vercel

Source menyediakan Vercel Node Function `api/team-message.js`, dengan logika server di `server/team-message.js`. Endpoint GET `/api/team-message` memvalidasi bearer token Supabase melalui Auth, lalu memeriksa profil berstatus active. Tidak menerima prompt/peran dari client. Pesan dibuat dengan OpenAI Responses API dan structured JSON; default model `gpt-4.1-mini`, dapat diganti lewat env. Hanya konteks peran admin/CS/advertiser dan nama tim yang dikirim; bukan data pelanggan, omzet atau nama anggota.

Aktivasi:

1. Deploy source ini melalui GitHub ke Vercel, termasuk folder `api/` dan `server/`. Backend ini tidak dijalankan oleh hosting statis demo Sites saat ini.
2. Pastikan Supabase sudah terhubung dan akun aktif dapat login.
3. Di Vercel → Project Settings → Environment Variables, tambahkan **OPENAI_API_KEY** sebagai secret server untuk environment yang dipakai. Opsional: **OPENAI_MODEL=gpt-4.1-mini**. Jangan awali key dengan VITE_, jangan commit key, dan jangan mengirimkannya dalam chat.
4. Backend memakai SUPABASE_URL / SUPABASE_ANON_KEY bila diisi, atau memakai URL/public key dari VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY yang sudah tersedia. Tidak perlu service_role key.
5. Redeploy. Login memakai akun aktif, buka dashboard. Label **Dibuat dengan OpenAI** muncul hanya setelah endpoint benar-benar mengembalikan pesan AI yang valid. Jika belum terhubung atau API gagal, UI memakai label **Pesan contoh**.

Satu generasi menghasilkan 8 pesan singkat. UI memutar daftar setiap 60 detik; tombol berikutnya hanya mengganti pesan di daftar. Backend cache satu jam per peran/model **per instance server yang hangat**, serta menggabungkan request bersamaan. Vercel dapat menjalankan banyak instance/cold start, jadi cache ini bukan batas biaya global. Kegagalan diberi jeda singkat; key dan detail respons error provider tidak dikirim ke browser. Maksimal output 650 token per generasi.

Untuk dev dengan backend gunakan Vercel CLI (`vercel dev`); `vite` saja tidak menjalankan folder api. Hosting statis Sites tetap memakai pesan contoh. Panggilan API nyata belum diuji karena key pengguna belum dikonfigurasi; tes memakai mock untuk auth, schema respons, cache, request paralel, kegagalan provider dan perlindungan key.

Referensi resmi: https://developers.openai.com/api/reference/python/resources/responses dan https://developers.openai.com/api/docs/models/gpt-4.1-mini .
