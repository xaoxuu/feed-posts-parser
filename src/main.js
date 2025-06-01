import * as core from '@actions/core';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger, handleError, withRetry, formatDate } from './utils.js';

const RETRY_TIMES = parseInt(core.getInput('retry_times') || 3);
const POSTS_COUNT = parseInt(core.getInput('posts_count') || 2);
const DATE_FORMAT = core.getInput('date_format') || 'YYYY-MM-DD HH:mm';

async function parseFeed(feedUrl) {
  try {
    const response = await axios.get(feedUrl, { timeout: 5000 });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const posts = [];

    $('feed > entry').slice(0, POSTS_COUNT).each((i, el) => {
      const title = $(el).find('title').text();
          let link = $(el).find('link[rel="alternate"]').attr('href');
          if (!link) {
            link = $(el).find('link').attr('href');
          }
      const published = $(el).find('published').text();
      const formattedPublished = published ? formatDate(published, DATE_FORMAT) : '';
      logger('info', `Extracted - Title: ${title}, Link: ${link}, Published: ${formattedPublished}`);
      if (title && link) {
        posts.push({ title, link, published: formattedPublished });
      }
    });

    return posts;
  } catch (error) {
    handleError(error, `Error parsing feed from ${feedUrl}`);
    return [];
  }
}

async function processIssue(issue) {
  try {
    logger('info', `Processing issue #${issue.number}`);
    if (!issue.body) {
      logger('warn', `Issue #${issue.number} has no body content, skipping...`);
      return null;
    }

    const match = issue.body.match(/```json\s*\{[\s\S]*?\}\s*```/m);
    const jsonMatch = match ? match[0].match(/\{[\s\S]*?\}/m) : null;

    if (!jsonMatch) {
      logger('warn', `No JSON content found in issue #${issue.number}`);
      return null;
    }

    logger('info', `Found JSON content in issue #${issue.number}`);
    const jsonData = JSON.parse(jsonMatch[0]);
    logger('info', `Got JSON content in issue #${issue.number}`, jsonData);
    
    // 获取 feed 数据
    const feedUrl = jsonData.feed;
    if (feedUrl) {
      logger('info', `Getting feed data from ${feedUrl}`);
      const posts = await withRetry(parseFeed, RETRY_TIMES, feedUrl);
      jsonData.posts = posts;
    }

    logger('info', `Converted JSON content in issue #${issue.number}`, jsonData);
    const newBody = issue.body.replace(jsonMatch[0], JSON.stringify(jsonData, null, 2));
    return { data: jsonData, newBody: newBody };
  } catch (error) {
    handleError(error, `Error processing issue #${issue.number}`);
    return null;
  }
}

async function run() {
  const token =  process.env.GITHUB_TOKEN;
  const owner = github.context.repo.owner;
  const repo = github.context.repo.repo;
  const { Octokit } = await import('@octokit/rest');
  const octokit = new Octokit({
    auth: token
  });

  try {
    const allIssues = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { data: issues } = await octokit.issues.listForRepo({
        owner,
        repo,
        state: 'open',
        per_page: 100,
        page
      });

      if (issues.length === 0) {
        hasMore = false;
      } else {
        allIssues.push(...issues);
        page++;
      }
    }

    logger('info', `Found ${allIssues.length} open issues.`);

    for (const issue of allIssues) {
      const result = await processIssue(issue);
      if (result) {
        // 更新 issue body
        await octokit.issues.update({
          owner,
          repo,
          issue_number: issue.number,
          body: result.newBody
        });
        logger('info', `Updated issue #${issue.number}`);
      }
    }

  } catch (error) {
    handleError(error, 'Error processing issues');
    process.exit(1);
  }
}

run();