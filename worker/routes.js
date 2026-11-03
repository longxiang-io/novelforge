// 由 worker/api 的文件路由生成，路径与原来的 /api/changjuan/* 一致。
import ai_model_get_js from './api/ai/model.get.js'
import ai_chats_index_get_js from './api/ai/chats/index.get.js'
import ai_chats_index_post_js from './api/ai/chats/index.post.js'
import ai_chats_id_get_js from './api/ai/chats/[id].get.js'
import ai_chats_id_delete_js from './api/ai/chats/[id].delete.js'
import ai_chats_id_messages_post_js from './api/ai/chats/[id]/messages.post.js'
import ai_chats_id_apply_post_js from './api/ai/chats/[id]/apply.post.js'
import ai_chats_id_create_book_post_js from './api/ai/chats/[id]/create-book.post.js'
import books_id_delete_js from './api/books/[id].delete.js'
import books_id_get_js from './api/books/[id].get.js'
import books_id_put_js from './api/books/[id].put.js'
import books_id_cards_get_js from './api/books/[id]/cards.get.js'
import books_id_export_txt_get_js from './api/books/[id]/export-txt.get.js'
import books_id_export_get_js from './api/books/[id]/export.get.js'
import books_id_foreshadows_get_js from './api/books/[id]/foreshadows.get.js'
import books_id_read_get_js from './api/books/[id]/read.get.js'
import books_id_search_get_js from './api/books/[id]/search.get.js'
import books_id_stats_get_js from './api/books/[id]/stats.get.js'
import books_id_versions_get_js from './api/books/[id]/versions.get.js'
import books_index_get_js from './api/books/index.get.js'
import books_index_post_js from './api/books/index.post.js'
import cards_id_delete_js from './api/cards/[id].delete.js'
import cards_id_put_js from './api/cards/[id].put.js'
import cards_id_history_get_js from './api/cards/[id]/history.get.js'
import cards_index_post_js from './api/cards/index.post.js'
import changes_id_put_js from './api/changes/[id].put.js'
import chapters_id_delete_js from './api/chapters/[id].delete.js'
import chapters_id_get_js from './api/chapters/[id].get.js'
import chapters_id_put_js from './api/chapters/[id].put.js'
import chapters_id_check_post_js from './api/chapters/[id]/check.post.js'
import chapters_id_confirm_post_js from './api/chapters/[id]/confirm.post.js'
import chapters_id_context_get_js from './api/chapters/[id]/context.get.js'
import chapters_id_extract_post_js from './api/chapters/[id]/extract.post.js'
import chapters_id_generate_post_js from './api/chapters/[id]/generate.post.js'
import chapters_id_summary_post_js from './api/chapters/[id]/summary.post.js'
import chapters_index_post_js from './api/chapters/index.post.js'
import config_index_get_js from './api/config/index.get.js'
import config_index_put_js from './api/config/index.put.js'
import config_models_post_js from './api/config/models.post.js'
import config_test_post_js from './api/config/test.post.js'
import foreshadows_id_delete_js from './api/foreshadows/[id].delete.js'
import foreshadows_id_put_js from './api/foreshadows/[id].put.js'
import foreshadows_index_post_js from './api/foreshadows/index.post.js'
import issues_id_put_js from './api/issues/[id].put.js'
import testcases_id_delete_js from './api/testcases/[id].delete.js'
import testcases_index_get_js from './api/testcases/index.get.js'
import testcases_index_post_js from './api/testcases/index.post.js'
import testcases_run_post_js from './api/testcases/run.post.js'
import testcases_seed_post_js from './api/testcases/seed.post.js'
import versions_id_get_js from './api/versions/[id].get.js'
import versions_id_restore_card_post_js from './api/versions/[id]/restore-card.post.js'
import versions_id_revert_post_js from './api/versions/[id]/revert.post.js'
import volumes_id_delete_js from './api/volumes/[id].delete.js'
import volumes_id_put_js from './api/volumes/[id].put.js'
import volumes_index_post_js from './api/volumes/index.post.js'

export const registerChangjuan = (app) => {
  app.get('/api/changjuan/ai/model', ai_model_get_js)
  app.get('/api/changjuan/ai/chats', ai_chats_index_get_js)
  app.post('/api/changjuan/ai/chats', ai_chats_index_post_js)
  app.get('/api/changjuan/ai/chats/:id', ai_chats_id_get_js)
  app.delete('/api/changjuan/ai/chats/:id', ai_chats_id_delete_js)
  app.post('/api/changjuan/ai/chats/:id/messages', ai_chats_id_messages_post_js)
  app.post('/api/changjuan/ai/chats/:id/apply', ai_chats_id_apply_post_js)
  app.post('/api/changjuan/ai/chats/:id/create-book', ai_chats_id_create_book_post_js)
  app.delete('/api/changjuan/books/:id', books_id_delete_js)
  app.get('/api/changjuan/books/:id', books_id_get_js)
  app.put('/api/changjuan/books/:id', books_id_put_js)
  app.get('/api/changjuan/books/:id/cards', books_id_cards_get_js)
  app.get('/api/changjuan/books/:id/export-txt', books_id_export_txt_get_js)
  app.get('/api/changjuan/books/:id/export', books_id_export_get_js)
  app.get('/api/changjuan/books/:id/foreshadows', books_id_foreshadows_get_js)
  app.get('/api/changjuan/books/:id/read', books_id_read_get_js)
  app.get('/api/changjuan/books/:id/search', books_id_search_get_js)
  app.get('/api/changjuan/books/:id/stats', books_id_stats_get_js)
  app.get('/api/changjuan/books/:id/versions', books_id_versions_get_js)
  app.get('/api/changjuan/books', books_index_get_js)
  app.post('/api/changjuan/books', books_index_post_js)
  app.delete('/api/changjuan/cards/:id', cards_id_delete_js)
  app.put('/api/changjuan/cards/:id', cards_id_put_js)
  app.get('/api/changjuan/cards/:id/history', cards_id_history_get_js)
  app.post('/api/changjuan/cards', cards_index_post_js)
  app.put('/api/changjuan/changes/:id', changes_id_put_js)
  app.delete('/api/changjuan/chapters/:id', chapters_id_delete_js)
  app.get('/api/changjuan/chapters/:id', chapters_id_get_js)
  app.put('/api/changjuan/chapters/:id', chapters_id_put_js)
  app.post('/api/changjuan/chapters/:id/check', chapters_id_check_post_js)
  app.post('/api/changjuan/chapters/:id/confirm', chapters_id_confirm_post_js)
  app.get('/api/changjuan/chapters/:id/context', chapters_id_context_get_js)
  app.post('/api/changjuan/chapters/:id/extract', chapters_id_extract_post_js)
  app.post('/api/changjuan/chapters/:id/generate', chapters_id_generate_post_js)
  app.post('/api/changjuan/chapters/:id/summary', chapters_id_summary_post_js)
  app.post('/api/changjuan/chapters', chapters_index_post_js)
  app.get('/api/changjuan/config', config_index_get_js)
  app.put('/api/changjuan/config', config_index_put_js)
  app.post('/api/changjuan/config/models', config_models_post_js)
  app.post('/api/changjuan/config/test', config_test_post_js)
  app.delete('/api/changjuan/foreshadows/:id', foreshadows_id_delete_js)
  app.put('/api/changjuan/foreshadows/:id', foreshadows_id_put_js)
  app.post('/api/changjuan/foreshadows', foreshadows_index_post_js)
  app.put('/api/changjuan/issues/:id', issues_id_put_js)
  app.delete('/api/changjuan/testcases/:id', testcases_id_delete_js)
  app.get('/api/changjuan/testcases', testcases_index_get_js)
  app.post('/api/changjuan/testcases', testcases_index_post_js)
  app.post('/api/changjuan/testcases/run', testcases_run_post_js)
  app.post('/api/changjuan/testcases/seed', testcases_seed_post_js)
  app.get('/api/changjuan/versions/:id', versions_id_get_js)
  app.post('/api/changjuan/versions/:id/restore-card', versions_id_restore_card_post_js)
  app.post('/api/changjuan/versions/:id/revert', versions_id_revert_post_js)
  app.delete('/api/changjuan/volumes/:id', volumes_id_delete_js)
  app.put('/api/changjuan/volumes/:id', volumes_id_put_js)
  app.post('/api/changjuan/volumes', volumes_index_post_js)
}
