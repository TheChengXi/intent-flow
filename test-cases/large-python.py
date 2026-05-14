# 大型 Python 测试用例：博客管理系统（约300行）

from typing import List, Dict, Optional, Set
from datetime import datetime, timedelta
from enum import Enum
import re
import hashlib

# ==================== 枚举定义 ====================

class PostStatus(Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    DELETED = "deleted"

class UserRole(Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    AUTHOR = "author"
    READER = "reader"

class CommentStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SPAM = "spam"

# ==================== 数据类 ====================

class User:
    def __init__(self, user_id: str, username: str, email: str, role: UserRole):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.role = role
        self.created_at = datetime.now()
        self.is_active = True

class Tag:
    def __init__(self, tag_id: str, name: str, slug: str):
        self.tag_id = tag_id
        self.name = name
        self.slug = slug
        self.post_count = 0

class Comment:
    def __init__(self, comment_id: str, post_id: str, author_id: str, content: str):
        self.comment_id = comment_id
        self.post_id = post_id
        self.author_id = author_id
        self.content = content
        self.status = CommentStatus.PENDING
        self.created_at = datetime.now()
        self.parent_id: Optional[str] = None

class Post:
    def __init__(self, post_id: str, title: str, content: str, author_id: str):
        self.post_id = post_id
        self.title = title
        self.content = content
        self.author_id = author_id
        self.status = PostStatus.DRAFT
        self.tags: List[str] = []
        self.view_count = 0
        self.like_count = 0
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.published_at: Optional[datetime] = None
        self.slug = self._generate_slug(title)

    def _generate_slug(self, title: str) -> str:
        slug = title.lower()
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'\s+', '-', slug)
        return slug[:100]

# ==================== 异常类 ====================

class BlogError(Exception):
    pass

class ValidationError(BlogError):
    pass

class PermissionError(BlogError):
    pass

class NotFoundError(BlogError):
    pass

# ==================== 博客管理器 ====================

class BlogManager:
    def __init__(self):
        self.posts: Dict[str, Post] = {}
        self.users: Dict[str, User] = {}
        self.tags: Dict[str, Tag] = {}
        self.comments: Dict[str, Comment] = {}
        self.post_tags: Dict[str, Set[str]] = {}
        self.user_likes: Dict[str, Set[str]] = {}

    # ==================== 文章管理 ====================

    def create_post(self, title: str, content: str, author_id: str, tags: List[str] = None) -> Post:
        """创建新文章"""
        if not title or len(title.strip()) == 0:
            raise ValidationError("Title cannot be empty")

        if len(title) > 200:
            raise ValidationError("Title cannot exceed 200 characters")

        if not content or len(content.strip()) == 0:
            raise ValidationError("Content cannot be empty")

        if len(content) < 50:
            raise ValidationError("Content must be at least 50 characters")

        author = self.users.get(author_id)
        if not author:
            raise NotFoundError(f"Author not found: {author_id}")

        if author.role not in [UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR]:
            raise PermissionError("User does not have permission to create posts")

        post_id = self._generate_post_id(title, author_id)
        post = Post(post_id, title.strip(), content.strip(), author_id)

        if tags:
            for tag_name in tags:
                tag = self._get_or_create_tag(tag_name)
                post.tags.append(tag.tag_id)
                tag.post_count += 1

        self.posts[post_id] = post
        return post

    def publish_post(self, post_id: str, user_id: str) -> Post:
        """发布文章"""
        post = self.posts.get(post_id)
        if not post:
            raise NotFoundError(f"Post not found: {post_id}")

        user = self.users.get(user_id)
        if not user:
            raise NotFoundError(f"User not found: {user_id}")

        if post.author_id != user_id and user.role not in [UserRole.ADMIN, UserRole.EDITOR]:
            raise PermissionError("User does not have permission to publish this post")

        if post.status == PostStatus.PUBLISHED:
            raise ValidationError("Post is already published")

        if post.status == PostStatus.DELETED:
            raise ValidationError("Cannot publish deleted post")

        post.status = PostStatus.PUBLISHED
        post.published_at = datetime.now()
        post.updated_at = datetime.now()

        return post

    def update_post(self, post_id: str, user_id: str, title: str = None,
                   content: str = None, tags: List[str] = None) -> Post:
        """更新文章"""
        post = self.posts.get(post_id)
        if not post:
            raise NotFoundError(f"Post not found: {post_id}")

        user = self.users.get(user_id)
        if not user:
            raise NotFoundError(f"User not found: {user_id}")

        if post.author_id != user_id and user.role not in [UserRole.ADMIN, UserRole.EDITOR]:
            raise PermissionError("User does not have permission to update this post")

        if post.status == PostStatus.DELETED:
            raise ValidationError("Cannot update deleted post")

        if title:
            if len(title.strip()) == 0:
                raise ValidationError("Title cannot be empty")
            if len(title) > 200:
                raise ValidationError("Title cannot exceed 200 characters")
            post.title = title.strip()
            post.slug = post._generate_slug(title)

        if content:
            if len(content.strip()) == 0:
                raise ValidationError("Content cannot be empty")
            if len(content) < 50:
                raise ValidationError("Content must be at least 50 characters")
            post.content = content.strip()

        if tags is not None:
            for old_tag_id in post.tags:
                old_tag = self.tags.get(old_tag_id)
                if old_tag:
                    old_tag.post_count -= 1

            post.tags = []
            for tag_name in tags:
                tag = self._get_or_create_tag(tag_name)
                post.tags.append(tag.tag_id)
                tag.post_count += 1

        post.updated_at = datetime.now()
        return post

    def delete_post(self, post_id: str, user_id: str) -> Post:
        """删除文章"""
        post = self.posts.get(post_id)
        if not post:
            raise NotFoundError(f"Post not found: {post_id}")

        user = self.users.get(user_id)
        if not user:
            raise NotFoundError(f"User not found: {user_id}")

        if post.author_id != user_id and user.role != UserRole.ADMIN:
            raise PermissionError("User does not have permission to delete this post")

        post.status = PostStatus.DELETED
        post.updated_at = datetime.now()

        for tag_id in post.tags:
            tag = self.tags.get(tag_id)
            if tag:
                tag.post_count -= 1

        return post

    # ==================== 评论管理 ====================

    def add_comment(self, post_id: str, author_id: str, content: str,
                   parent_id: str = None) -> Comment:
        """添加评论"""
        post = self.posts.get(post_id)
        if not post:
            raise NotFoundError(f"Post not found: {post_id}")

        if post.status != PostStatus.PUBLISHED:
            raise ValidationError("Cannot comment on unpublished post")

        author = self.users.get(author_id)
        if not author:
            raise NotFoundError(f"Author not found: {author_id}")

        if not author.is_active:
            raise PermissionError("User account is not active")

        if not content or len(content.strip()) == 0:
            raise ValidationError("Comment content cannot be empty")

        if len(content) > 1000:
            raise ValidationError("Comment cannot exceed 1000 characters")

        if parent_id:
            parent_comment = self.comments.get(parent_id)
            if not parent_comment:
                raise NotFoundError(f"Parent comment not found: {parent_id}")
            if parent_comment.post_id != post_id:
                raise ValidationError("Parent comment does not belong to this post")

        comment_id = self._generate_comment_id(post_id, author_id)
        comment = Comment(comment_id, post_id, author_id, content.strip())
        comment.parent_id = parent_id

        if self._is_spam(content):
            comment.status = CommentStatus.SPAM
        elif author.role in [UserRole.ADMIN, UserRole.EDITOR]:
            comment.status = CommentStatus.APPROVED
        else:
            comment.status = CommentStatus.PENDING

        self.comments[comment_id] = comment
        return comment

    def approve_comment(self, comment_id: str, moderator_id: str) -> Comment:
        """批准评论"""
        comment = self.comments.get(comment_id)
        if not comment:
            raise NotFoundError(f"Comment not found: {comment_id}")

        moderator = self.users.get(moderator_id)
        if not moderator:
            raise NotFoundError(f"Moderator not found: {moderator_id}")

        if moderator.role not in [UserRole.ADMIN, UserRole.EDITOR]:
            raise PermissionError("User does not have permission to moderate comments")

        if comment.status == CommentStatus.SPAM:
            raise ValidationError("Cannot approve spam comment")

        comment.status = CommentStatus.APPROVED
        return comment

    # ==================== 点赞功能 ====================

    def like_post(self, post_id: str, user_id: str) -> Post:
        """点赞文章"""
        post = self.posts.get(post_id)
        if not post:
            raise NotFoundError(f"Post not found: {post_id}")

        user = self.users.get(user_id)
        if not user:
            raise NotFoundError(f"User not found: {user_id}")

        if post.status != PostStatus.PUBLISHED:
            raise ValidationError("Cannot like unpublished post")

        if user_id not in self.user_likes:
            self.user_likes[user_id] = set()

        if post_id in self.user_likes[user_id]:
            raise ValidationError("User has already liked this post")

        self.user_likes[user_id].add(post_id)
        post.like_count += 1
        return post

    def unlike_post(self, post_id: str, user_id: str) -> Post:
        """取消点赞"""
        post = self.posts.get(post_id)
        if not post:
            raise NotFoundError(f"Post not found: {post_id}")

        user = self.users.get(user_id)
        if not user:
            raise NotFoundError(f"User not found: {user_id}")

        if user_id not in self.user_likes or post_id not in self.user_likes[user_id]:
            raise ValidationError("User has not liked this post")

        self.user_likes[user_id].remove(post_id)
        post.like_count -= 1
        return post

    # ==================== 查询功能 ====================

    def get_posts_by_author(self, author_id: str) -> List[Post]:
        """获取作者的所有文章"""
        return [post for post in self.posts.values() if post.author_id == author_id]

    def get_posts_by_tag(self, tag_id: str) -> List[Post]:
        """获取标签下的所有文章"""
        return [post for post in self.posts.values() if tag_id in post.tags]

    def get_published_posts(self, limit: int = 10, offset: int = 0) -> List[Post]:
        """获取已发布的文章（分页）"""
        published = [p for p in self.posts.values() if p.status == PostStatus.PUBLISHED]
        published.sort(key=lambda x: x.published_at, reverse=True)
        return published[offset:offset + limit]

    def search_posts(self, keyword: str) -> List[Post]:
        """搜索文章"""
        keyword_lower = keyword.lower()
        results = []
        for post in self.posts.values():
            if post.status == PostStatus.PUBLISHED:
                if keyword_lower in post.title.lower() or keyword_lower in post.content.lower():
                    results.append(post)
        return results

    # ==================== 辅助方法 ====================

    def _generate_post_id(self, title: str, author_id: str) -> str:
        """生成文章ID"""
        timestamp = datetime.now().isoformat()
        raw = f"{title}{author_id}{timestamp}"
        return hashlib.md5(raw.encode()).hexdigest()[:16]

    def _generate_comment_id(self, post_id: str, author_id: str) -> str:
        """生成评论ID"""
        timestamp = datetime.now().isoformat()
        raw = f"{post_id}{author_id}{timestamp}"
        return hashlib.md5(raw.encode()).hexdigest()[:16]

    def _get_or_create_tag(self, tag_name: str) -> Tag:
        """获取或创建标签"""
        tag_name = tag_name.strip().lower()
        slug = re.sub(r'[^a-z0-9\s-]', '', tag_name)
        slug = re.sub(r'\s+', '-', slug)

        for tag in self.tags.values():
            if tag.slug == slug:
                return tag

        tag_id = hashlib.md5(slug.encode()).hexdigest()[:12]
        tag = Tag(tag_id, tag_name, slug)
        self.tags[tag_id] = tag
        return tag

    def _is_spam(self, content: str) -> bool:
        """简单的垃圾评论检测"""
        spam_keywords = ['viagra', 'casino', 'lottery', 'click here', 'buy now']
        content_lower = content.lower()
        return any(keyword in content_lower for keyword in spam_keywords)

    def add_user(self, user: User) -> None:
        """添加用户"""
        self.users[user.user_id] = user
