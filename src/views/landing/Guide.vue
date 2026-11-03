<template>
  <div class="landing guide">
    <header class="nav">
      <div class="wrap nav-inner">
        <router-link class="brand" to="/" :aria-label="$t('brand')">
          <BrandMark />
        </router-link>
        <nav class="nav-actions" :aria-label="$t('public.guide.nav.account')">
          <LocaleSwitch />
          <router-link class="nav-doc on" to="/guide">{{ $t('public.guide.nav.guide') }}</router-link>
          <router-link v-if="loggedIn" class="btn btn-primary" to="/changjuan">{{ $t('public.guide.nav.shelf') }}</router-link>
          <template v-else>
            <router-link class="btn btn-primary" to="/login">{{ $t('public.guide.nav.login') }}</router-link>
            <router-link class="btn btn-secondary" to="/register">{{ $t('public.guide.nav.register') }}</router-link>
          </template>
        </nav>
      </div>
    </header>

    <main>
      <div class="wrap guide-layout">
        <nav class="toc" :aria-label="$t('public.guide.tocLabel')">
          <a href="#prepare">{{ $t('public.guide.toc.prepare') }}</a>
          <a href="#register">{{ $t('public.guide.toc.register') }}</a>
          <a href="#model">{{ $t('public.guide.toc.model') }}</a>
          <a href="#book">{{ $t('public.guide.toc.book') }}</a>
          <a href="#outline">{{ $t('public.guide.toc.outline') }}</a>
          <a href="#write">{{ $t('public.guide.toc.write') }}</a>
          <a href="#check">{{ $t('public.guide.toc.check') }}</a>
          <a href="#confirm">{{ $t('public.guide.toc.confirm') }}</a>
          <a href="#memory">{{ $t('public.guide.toc.memory') }}</a>
          <a href="#foreshadow">{{ $t('public.guide.toc.foreshadow') }}</a>
          <a href="#after">{{ $t('public.guide.toc.after') }}</a>
          <a href="#phone">{{ $t('public.guide.toc.phone') }}</a>
          <a href="#trouble">{{ $t('public.guide.toc.trouble') }}</a>
        </nav>

        <article class="guide-article">
          <h1>{{ $t('public.guide.title') }}</h1>

          <section id="prepare">
            <h2>{{ $t('public.guide.prepare.title') }}</h2>
            <ul>
              <li>{{ $t('public.guide.prepare.key') }}</li>
              <li>{{ $t('public.guide.prepare.privacy') }}</li>
            </ul>
          </section>

          <section id="register">
            <h2>{{ $t('public.guide.register.title') }}</h2>
            <ol>
              <li>{{ $t('public.guide.register.step1') }}</li>
              <li>{{ $t('public.guide.register.step2') }}</li>
              <li>{{ $t('public.guide.register.step3') }}</li>
              <li>{{ $t('public.guide.register.step4') }}</li>
            </ol>
          </section>

          <section id="model">
            <h2>{{ $t('public.guide.model.title') }}</h2>
            <p>{{ $t('public.guide.model.lead') }}</p>
            <ol>
              <li>{{ $t('public.guide.model.where') }}</li>
              <i18n-t keypath="public.guide.model.provider" tag="li">
                <template #ark><code>https://ark.cn-beijing.volces.com/api/v3</code></template>
                <template #v1><code>/v1</code></template>
              </i18n-t>
              <li>{{ $t('public.guide.model.key') }}</li>
              <li>
                {{ $t('public.guide.model.store') }}
                <ul>
                  <li>{{ $t('public.guide.model.server') }}</li>
                  <li>{{ $t('public.guide.model.browser') }}</li>
                </ul>
              </li>
              <li>{{ $t('public.guide.model.test') }}</li>
              <li>
                {{ $t('public.guide.model.tasksIntro') }}
                <ul>
                  <li>{{ $t('public.guide.model.taskGenerate') }}</li>
                  <li>{{ $t('public.guide.model.taskCheck') }}</li>
                  <li>{{ $t('public.guide.model.taskExtract') }}</li>
                  <li>{{ $t('public.guide.model.taskSummary') }}</li>
                  <li>{{ $t('public.guide.model.taskChat') }}</li>
                </ul>
              </li>
              <i18n-t keypath="public.guide.model.catalog" tag="li">
                <template #docs>
                  <a class="ext" href="https://www.volcengine.com/docs/82379/1330310" target="_blank" rel="noopener noreferrer">{{ $t('public.guide.model.catalogLink') }}</a>
                </template>
              </i18n-t>
              <li>{{ $t('public.guide.model.save') }}</li>
            </ol>
          </section>

          <section id="book">
            <h2>{{ $t('public.guide.book.title') }}</h2>
            <ol>
              <li>{{ $t('public.guide.book.chat') }}</li>
              <li>{{ $t('public.guide.book.self') }}</li>
              <li>{{ $t('public.guide.book.fields') }}</li>
              <li>{{ $t('public.guide.book.create') }}</li>
              <li>{{ $t('public.guide.book.shelf') }}</li>
            </ol>
          </section>

          <section id="outline">
            <h2>{{ $t('public.guide.outline.title') }}</h2>
            <p>{{ $t('public.guide.outline.lead') }}</p>
            <ol>
              <li>{{ $t('public.guide.outline.open') }}</li>
              <li>{{ $t('public.guide.outline.tree') }}</li>
              <li>{{ $t('public.guide.outline.layers') }}</li>
              <li>
                {{ $t('public.guide.outline.fillIntro') }}
                <ul>
                  <li>{{ $t('public.guide.outline.chapterTitle') }}</li>
                  <li>{{ $t('public.guide.outline.goal') }}</li>
                  <li>{{ $t('public.guide.outline.conflict') }}</li>
                  <li>{{ $t('public.guide.outline.payoff') }}</li>
                  <li>{{ $t('public.guide.outline.hook') }}</li>
                  <li>{{ $t('public.guide.outline.cast') }}</li>
                  <li>{{ $t('public.guide.outline.length') }}</li>
                  <li>{{ $t('public.guide.outline.linked') }}</li>
                </ul>
              </li>
              <li>{{ $t('public.guide.outline.ai') }}</li>
              <li>{{ $t('public.guide.outline.generate') }}</li>
              <li>{{ $t('public.guide.outline.rewrite') }}</li>
            </ol>
          </section>

          <section id="write">
            <h2>{{ $t('public.guide.write.title') }}</h2>
            <p>{{ $t('public.guide.write.lead') }}</p>
            <ol>
              <li>{{ $t('public.guide.write.list') }}</li>
              <li>{{ $t('public.guide.write.context') }}</li>
              <li>{{ $t('public.guide.write.generate') }}</li>
              <li>{{ $t('public.guide.write.continue') }}</li>
              <li>{{ $t('public.guide.write.regenerate') }}</li>
              <li>{{ $t('public.guide.write.stop') }}</li>
              <li>{{ $t('public.guide.write.background') }}</li>
              <li>{{ $t('public.guide.write.manual') }}</li>
            </ol>
          </section>

          <section id="check">
            <h2>{{ $t('public.guide.check.title') }}</h2>
            <p>{{ $t('public.guide.check.lead') }}</p>
            <ol>
              <li>{{ $t('public.guide.check.levels') }}</li>
              <li>{{ $t('public.guide.check.card') }}</li>
              <li>{{ $t('public.guide.check.falsePositive') }}</li>
              <li>{{ $t('public.guide.check.changed') }}</li>
              <li>{{ $t('public.guide.check.blocked') }}</li>
            </ol>
          </section>

          <section id="confirm">
            <h2>{{ $t('public.guide.confirm.title') }}</h2>
            <p>{{ $t('public.guide.confirm.lead') }}</p>
            <ol>
              <li>{{ $t('public.guide.confirm.extract') }}</li>
              <li>
                {{ $t('public.guide.confirm.reviewIntro') }}
                <ul>
                  <li>{{ $t('public.guide.confirm.alive') }}</li>
                  <li>{{ $t('public.guide.confirm.fresh') }}</li>
                  <li>{{ $t('public.guide.confirm.hooks') }}</li>
                </ul>
                {{ $t('public.guide.confirm.reviewTail') }}
              </li>
              <li>{{ $t('public.guide.confirm.auto') }}</li>
              <li>{{ $t('public.guide.confirm.commit') }}</li>
              <li>{{ $t('public.guide.confirm.summary') }}</li>
              <li>{{ $t('public.guide.confirm.next') }}</li>
              <li>{{ $t('public.guide.confirm.undo') }}</li>
            </ol>
          </section>

          <section id="memory">
            <h2>{{ $t('public.guide.memory.title') }}</h2>
            <ol>
              <li>{{ $t('public.guide.memory.tabs') }}</li>
              <li>{{ $t('public.guide.memory.cards') }}</li>
              <li>{{ $t('public.guide.memory.settings') }}</li>
              <li>{{ $t('public.guide.memory.create') }}</li>
              <li>{{ $t('public.guide.memory.summaries') }}</li>
              <li>{{ $t('public.guide.memory.edits') }}</li>
            </ol>
          </section>

          <section id="foreshadow">
            <h2>{{ $t('public.guide.foreshadow.title') }}</h2>
            <ol>
              <li>{{ $t('public.guide.foreshadow.add') }}</li>
              <li>{{ $t('public.guide.foreshadow.fields') }}</li>
              <li>{{ $t('public.guide.foreshadow.stats') }}</li>
              <li>{{ $t('public.guide.foreshadow.actions') }}</li>
              <li>{{ $t('public.guide.foreshadow.timing') }}</li>
            </ol>
          </section>

          <section id="after">
            <h2>{{ $t('public.guide.after.title') }}</h2>
            <h3>{{ $t('public.guide.after.searchTitle') }}</h3>
            <p>{{ $t('public.guide.after.search') }}</p>
            <h3>{{ $t('public.guide.after.readTitle') }}</h3>
            <p>{{ $t('public.guide.after.read') }}</p>
            <h3>{{ $t('public.guide.after.statsTitle') }}</h3>
            <p>{{ $t('public.guide.after.stats') }}</p>
            <p>{{ $t('public.guide.after.tests') }}</p>
            <h3>{{ $t('public.guide.after.exportTitle') }}</h3>
            <ul>
              <li>{{ $t('public.guide.after.exportZip') }}</li>
              <li>{{ $t('public.guide.after.exportTxt') }}</li>
            </ul>
            <h3>{{ $t('public.guide.after.versionsTitle') }}</h3>
            <p>{{ $t('public.guide.after.versions') }}</p>
            <h3>{{ $t('public.guide.after.bookTitle') }}</h3>
            <p>{{ $t('public.guide.after.book') }}</p>
            <h3>{{ $t('public.guide.after.profileTitle') }}</h3>
            <p>{{ $t('public.guide.after.profile') }}</p>
          </section>

          <section id="phone">
            <h2>{{ $t('public.guide.phone.title') }}</h2>
            <p>{{ $t('public.guide.phone.lead') }}</p>
            <ul>
              <li>{{ $t('public.guide.phone.top') }}</li>
              <li>{{ $t('public.guide.phone.tabs') }}</li>
              <li>{{ $t('public.guide.phone.write') }}</li>
              <li>{{ $t('public.guide.phone.outline') }}</li>
              <li>{{ $t('public.guide.phone.lists') }}</li>
            </ul>
          </section>

          <section id="trouble">
            <h2>{{ $t('public.guide.trouble.title') }}</h2>
            <h3>{{ $t('public.guide.trouble.modelTitle') }}</h3>
            <p>{{ $t('public.guide.trouble.model') }}</p>
            <h3>{{ $t('public.guide.trouble.localTitle') }}</h3>
            <p>{{ $t('public.guide.trouble.local') }}</p>
            <h3>{{ $t('public.guide.trouble.grayTitle') }}</h3>
            <p>{{ $t('public.guide.trouble.gray') }}</p>
            <h3>{{ $t('public.guide.trouble.thinkingTitle') }}</h3>
            <p>{{ $t('public.guide.trouble.thinking') }}</p>
            <h3>{{ $t('public.guide.trouble.staleTitle') }}</h3>
            <p>{{ $t('public.guide.trouble.stale') }}</p>
            <h3>{{ $t('public.guide.trouble.summaryTitle') }}</h3>
            <p>{{ $t('public.guide.trouble.summary') }}</p>
            <h3>{{ $t('public.guide.trouble.editTitle') }}</h3>
            <p>{{ $t('public.guide.trouble.edit') }}</p>
          </section>
        </article>
      </div>
    </main>

    <footer class="foot">
      <p><router-link to="/">{{ $t('public.guide.backHome') }}</router-link><span class="sep">·</span><span>{{ $t('brand') }}</span><span class="sep">·</span><span>{{ year }}</span></p>
    </footer>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import './landing.css'
import './guide.css'
import BrandMark from '../../components/BrandMark.vue'
import LocaleSwitch from '../../components/LocaleSwitch.vue'

const loggedIn = ref(typeof localStorage !== 'undefined' && !!localStorage.getItem('token'))
const year = new Date().getFullYear()
</script>
