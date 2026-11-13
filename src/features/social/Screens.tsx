import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useBeta } from "../../beta/context";
import { getLiveApi } from "../../beta/runtime";
import { Body, Button, Feedback, Field, Sheet, useAction } from "../../beta/ui";
import { colors, fonts } from "../../theme";
import type {
  PublicCollector,
  SharedBottle,
  SocialPage,
  ShelfPost,
} from "./types";
import { samplePhoto } from "../app/samplePhoto";
import AsyncStorage from "@react-native-async-storage/async-storage";
const empty: SocialPage = { posts: [], page_enabled: false, profile: null };
const demoKey = "fraggy.demo.social.v1";
type Write = {
  p_action: string;
  p_target?: string;
  p_text?: string;
  p_bottles?: string[];
  p_enabled?: boolean;
};
function Icon({
  name,
  label,
  onPress,
  active = false,
  disabled = false,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.icon,
        { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
      ]}
    >
      <Feather
        name={name}
        size={23}
        color={active ? colors.green : colors.ink}
      />
    </Pressable>
  );
}
function BottleImage({
  bottle,
  demo,
}: {
  bottle: SharedBottle;
  demo: boolean;
}) {
  const [uri, setUri] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setUri("");
    setFailed(false);
    if (demo) {
      setUri(samplePhoto);
      return;
    }
    void getLiveApi()
      .then((api) =>
        api.supabase.storage
          .from("cutouts")
          .createSignedUrl(bottle.image_path, 60),
      )
      .then(({ data, error }) => {
        if (active) {
          if (error) setFailed(true);
          else setUri(data!.signedUrl);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [bottle.image_path, demo]);
  return (
    <View style={s.bottle}>
      <View style={s.contact} />
      {uri && !failed ? (
        <Image
          source={{ uri }}
          resizeMode="contain"
          style={s.cutout}
          accessibilityLabel={`${bottle.brand}, ${bottle.name}`}
          onError={() => setFailed(true)}
        />
      ) : failed ? (
        <Text style={s.photoError}>Photo unavailable</Text>
      ) : (
        <ActivityIndicator color={colors.ivory} />
      )}
    </View>
  );
}
function ShelfImage({
  bottles,
  demo,
}: {
  bottles: SharedBottle[];
  demo: boolean;
}) {
  return (
    <View style={s.cabinet}>
      {[bottles.slice(0, 3), bottles.slice(3, 6)]
        .filter((row) => row.length)
        .map((row, i) => (
          <View key={i}>
            <View style={s.shelfRow}>
              {row.map((b) => (
                <BottleImage key={b.id} bottle={b} demo={demo} />
              ))}
            </View>
            <View style={s.ledge} />
          </View>
        ))}
    </View>
  );
}
function FeedView({
  demo,
  viewer,
  read,
  write,
  onExit,
  ownBottles = [],
}: {
  demo: boolean;
  viewer: string | null;
  read: (
    owner?: string,
    following?: boolean,
    before?: ShelfPost,
  ) => Promise<SocialPage>;
  write?: (input: Write) => Promise<void>;
  onExit?: () => void;
  ownBottles?: SharedBottle[];
}) {
  const [page, setPage] = useState<SocialPage>(empty),
    [posts, setPosts] = useState<ShelfPost[]>([]),
    [following, setFollowing] = useState(false),
    [owner, setOwner] = useState<PublicCollector | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [more, setMore] = useState(true),
    [compose, setCompose] = useState(false),
    [settings, setSettings] = useState(false),
    [caption, setCaption] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [comments, setComments] = useState<ShelfPost | null>(null),
    [comment, setComment] = useState(""),
    [menu, setMenu] = useState<ShelfPost | null>(null),
    [reportText, setReportText] = useState("");
  const generation = useRef(0),
    active = useRef(true),
    actions = useAction(),
    latest = useRef(posts);
  latest.current = posts;
  const refresh = useCallback(
    async (append = false) => {
      const token = ++generation.current;
      setBusy(true);
      setError("");
      try {
        const next = await read(
          owner?.id,
          following,
          append ? latest.current.at(-1) : undefined,
        );
        if (active.current && generation.current === token) {
          setPage(next);
          setPosts((old) =>
            append
              ? [
                  ...old,
                  ...next.posts.filter((p) => !old.some((x) => x.id === p.id)),
                ]
              : next.posts,
          );
          setMore(next.posts.length === 20);
        }
      } catch (e) {
        if (active.current && generation.current === token) {
          setError(
            e instanceof Error
              ? e.message
              : "Could not load shelves. Try again.",
          );
          if (!demo) {
            setPosts([]);
            setPage(empty);
          }
        }
      } finally {
        if (active.current && generation.current === token) setBusy(false);
      }
    },
    [read, owner?.id, following, demo],
  );
  useEffect(() => {
    active.current = true;
    void refresh();
    const interval = setInterval(() => void refresh(), 60000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      active.current = false;
      ++generation.current;
      clearInterval(interval);
      subscription.remove();
    };
  }, [refresh]);
  const act = async (input: Write) => {
    if (!write) return;
    await actions.act(async () => {
      await write(input);
      await refresh();
    });
  };
  const currentComments = posts.find((p) => p.id === comments?.id);
  return (
    <SafeAreaView style={s.page}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <View style={s.header}>
          <Text style={s.logo}>fraggy.</Text>
          <View style={s.inline}>
            {write && (
              <Icon
                name="plus-square"
                label="Share bottles"
                onPress={() => setCompose(true)}
              />
            )}
            <Icon
              name={onExit ? "log-in" : "settings"}
              label={onExit ? "Sign in or return" : "Public page settings"}
              onPress={() => (onExit ? onExit() : setSettings(true))}
            />
          </View>
        </View>
        {demo && (
          <Text style={s.notice}>
            DEMO · Sample shelves and simulated interactions
          </Text>
        )}
        {owner ? (
          <View style={s.profile}>
            <Icon
              name="arrow-left"
              label="Back to feed"
              onPress={() => setOwner(null)}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{owner.name}</Text>
              <Text style={s.meta}>{owner.handle}</Text>
              <Body>{owner.bio}</Body>
              {page.profile?.followers !== undefined && (
                <Text style={s.meta}>{page.profile.followers} followers</Text>
              )}
            </View>
          </View>
        ) : (
          <View style={s.switcher}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: !following }}
              onPress={() => setFollowing(false)}
              style={s.filter}
            >
              <Text style={[s.filterText, !following && s.selected]}>
                Latest shelves
              </Text>
            </Pressable>
            {viewer && (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: following }}
                onPress={() => setFollowing(true)}
                style={s.filter}
              >
                <Text style={[s.filterText, following && s.selected]}>
                  Following
                </Text>
              </Pressable>
            )}
            <Icon
              name="refresh-cw"
              label="Refresh feed"
              disabled={busy}
              onPress={() => void refresh()}
            />
          </View>
        )}
        {!!error && (
          <View style={s.empty}>
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
            <Button
              title="Retry feed"
              onPress={() => void refresh()}
              secondary
            />
          </View>
        )}
        <Feedback busy={busy || actions.busy} error={actions.error} />
        {!busy && !error && !posts.length && (
          <View style={s.empty}>
            <Text style={s.name}>
              {following
                ? "Your circle starts here."
                : "A shelf worth sharing."}
            </Text>
            <Body>
              {following
                ? "Follow collectors from Latest shelves to see their posts here."
                : "Share a bottle, your daily rotation, or the shelf you’ve been building."}
            </Body>
            {write && (
              <Button
                title="Share your first shelf"
                onPress={() => setCompose(true)}
              />
            )}
          </View>
        )}
        {posts.map((post) => (
          <View key={post.id} style={s.post}>
            <View style={s.postHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${post.collector.handle}'s public profile`}
                onPress={() => setOwner(post.collector)}
                style={s.identity}
              >
                <View style={s.avatar}>
                  <Text style={s.initial}>
                    {post.collector.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{post.collector.handle}</Text>
                  <Text style={s.meta}>
                    {post.bottles.length === 1
                      ? post.bottles[0].brand
                      : `${post.bottles.length} bottles · shelf post`}
                  </Text>
                </View>
              </Pressable>
              {write && post.owner_id !== viewer && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${post.following ? "Unfollow" : "Follow"} ${post.collector.handle}`}
                  onPress={() =>
                    void act({
                      p_action: "follow",
                      p_target: post.owner_id,
                      p_enabled: !post.following,
                    })
                  }
                  disabled={actions.busy}
                  style={s.follow}
                >
                  <Text style={s.followText}>
                    {post.following ? "Following" : "Follow"}
                  </Text>
                </Pressable>
              )}
            </View>
            <ShelfImage bottles={post.bottles} demo={demo} />
            <View style={s.postBottom}>
              <View style={s.inline}>
                <Icon
                  name="heart"
                  active={post.liked}
                  label={`${post.liked ? "Unlike" : "Like"} post, ${post.likes} likes`}
                  disabled={!write || actions.busy}
                  onPress={() =>
                    void act({
                      p_action: "like",
                      p_target: post.id,
                      p_enabled: !post.liked,
                    })
                  }
                />
                <Text style={s.meta}>{post.likes}</Text>
                <Icon
                  name="message-circle"
                  label={`${post.comment_count} comments`}
                  onPress={() => setComments(post)}
                />
                <Text style={s.meta}>{post.comment_count}</Text>
                <View style={{ flex: 1 }} />
                <Icon
                  name="more-horizontal"
                  label="Post options"
                  onPress={() => setMenu(post)}
                />
              </View>
              {!!post.caption && (
                <Text style={s.caption}>
                  <Text style={s.name}>{post.collector.handle} </Text>
                  {post.caption}
                </Text>
              )}
              <Text style={s.meta}>
                {post.bottles.map((b) => b.name).join(" · ")}
              </Text>
              <Text style={s.date}>
                {new Date(post.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        ))}
        {more && posts.length > 0 && (
          <Button
            title="More shelves"
            secondary
            disabled={busy}
            onPress={() => void refresh(true)}
          />
        )}
        {!viewer && (
          <Text style={s.notice}>
            Public posts · Sign in to follow, comment or trade.
          </Text>
        )}
      </ScrollView>
      <Sheet title="Post options" open={!!menu} onClose={() => setMenu(null)}>
        {menu && viewer === menu.owner_id ? (
          <Button
            title="Remove public post"
            disabled={actions.busy}
            onPress={() =>
              void actions.act(async () => {
                await write?.({ p_action: "remove", p_target: menu.id });
                setMenu(null);
                await refresh();
              })
            }
          />
        ) : write && menu ? (
          <>
            <Field
              label="Report reason"
              value={reportText}
              onChangeText={setReportText}
              maxLength={450}
              multiline
            />
            <Button
              title="Report post"
              disabled={!reportText.trim() || actions.busy}
              onPress={() =>
                void actions.act(async () => {
                  await write({
                    p_action: "report",
                    p_target: menu.owner_id,
                    p_text: `Post ${menu.id}: ${reportText}`,
                  });
                  setMenu(null);
                  setReportText("");
                })
              }
            />
            <Button
              title="Block collector"
              secondary
              disabled={actions.busy}
              onPress={() =>
                void actions.act(async () => {
                  await write({
                    p_action: "block",
                    p_target: menu.owner_id,
                    p_enabled: true,
                  });
                  setMenu(null);
                  await refresh();
                })
              }
            />
            <Body>
              Blocking hides signed-in contact. Public posts may still be
              visible while signed out. Accepted trades remain accessible.
            </Body>
          </>
        ) : (
          <Body>Sign in to report or block this collector.</Body>
        )}
        <Feedback {...actions} />
      </Sheet>
      <Sheet
        title="Your public collector page"
        open={settings}
        onClose={() => setSettings(false)}
      >
        <Body>
          Your handle, name, bio and posts can be viewed by anyone. Your full
          collection, original photos and trade details stay private.
        </Body>
        <Body>
          Hiding your page hides its posts and shared cutouts from future
          requests. Previously downloaded public content cannot be recalled.
        </Body>
        {write && (
          <Button
            title={
              page.page_enabled
                ? "Hide my public page"
                : "Enable my public page"
            }
            disabled={actions.busy}
            onPress={() =>
              void act({ p_action: "page", p_enabled: !page.page_enabled })
            }
          />
        )}
        <Feedback {...actions} />
      </Sheet>
      <Sheet
        title="Share a shelf"
        open={compose}
        onClose={() => setCompose(false)}
      >
        <Body>
          Only the selected cutouts and fragrance names will be public. Original
          photos, condition and private notes stay private.
        </Body>
        {!page.page_enabled ? (
          <>
            <Body>
              First enable your public collector page to share with everyone.
            </Body>
            <Button
              title="Enable my public page"
              disabled={actions.busy}
              onPress={() => void act({ p_action: "page", p_enabled: true })}
            />
          </>
        ) : (
          <>
            <Field
              label="Caption"
              value={caption}
              onChangeText={setCaption}
              maxLength={500}
              multiline
            />
            {ownBottles.length === 0 && (
              <Body>Add a bottle to My Shelf first, then share it here.</Body>
            )}
            {ownBottles.map((b) => (
              <Button
                key={b.id}
                title={`${selected.includes(b.id) ? "✓ " : ""}${b.brand} · ${b.name}`}
                secondary={!selected.includes(b.id)}
                onPress={() =>
                  setSelected((old) =>
                    old.includes(b.id)
                      ? old.filter((id) => id !== b.id)
                      : old.length < 6
                        ? [...old, b.id]
                        : old,
                  )
                }
              />
            ))}
            <Body>{selected.length}/6 selected · Public post</Body>
            <Button
              title="Publish shelf"
              disabled={actions.busy || !selected.length}
              onPress={() =>
                void actions.act(async () => {
                  await write?.({
                    p_action: "post",
                    p_bottles: selected,
                    p_text: caption,
                  });
                  setCompose(false);
                  setCaption("");
                  setSelected([]);
                  await refresh();
                })
              }
            />
          </>
        )}
        <Feedback {...actions} />
      </Sheet>
      <Sheet
        title="Comments"
        open={!!comments}
        onClose={() => setComments(null)}
      >
        {currentComments?.comments.map((c) => (
          <View key={c.id} style={s.comment}>
            <Text style={s.name}>{c.handle}</Text>
            <Body>{c.body}</Body>
            {write &&
              (c.owner_id === viewer ||
                currentComments.owner_id === viewer) && (
                <Icon
                  name="trash-2"
                  label="Remove comment"
                  disabled={actions.busy}
                  onPress={() =>
                    void act({ p_action: "remove-comment", p_target: c.id })
                  }
                />
              )}
          </View>
        ))}
        {(currentComments?.comment_count || 0) > 30 && (
          <Body>Showing the latest 30 comments.</Body>
        )}
        {write ? (
          <>
            <Field
              label="Add a comment"
              value={comment}
              onChangeText={setComment}
              maxLength={500}
              multiline
            />
            <Button
              title="Post comment"
              disabled={!comment.trim() || actions.busy}
              onPress={() =>
                void actions.act(async () => {
                  await write({
                    p_action: "comment",
                    p_target: comments!.id,
                    p_text: comment,
                  });
                  setComment("");
                  await refresh();
                })
              }
            />
          </>
        ) : (
          <Body>Sign in to join the conversation.</Body>
        )}
        <Feedback {...actions} />
      </Sheet>
    </SafeAreaView>
  );
}
export function FeedScreen() {
  const b = useBeta(),
    viewer = b.session!.user.id,
    [demoPage, setDemoPage] = useState<SocialPage | null>(null),
    demoRef = useRef<SocialPage | null>(null);
  const seed = useCallback(
    (): SocialPage => ({
      page_enabled: true,
      profile: null,
      posts: b.state.bottles
        .filter((x) => x.owner_id !== viewer)
        .slice(0, 3)
        .map((x) => ({
          id: "post-" + x.id,
          owner_id: x.owner_id,
          caption: "A little shelf inspiration. Sample post.",
          bottles: [
            {
              id: x.id,
              brand: x.brand,
              name: x.name,
              image_path: x.image_path!,
            },
          ],
          created_at: new Date().toISOString(),
          collector: b.state.profiles.find((p) => p.id === x.owner_id)!,
          liked: false,
          following: false,
          likes: 0,
          comment_count: 0,
          comments: [],
        })),
    }),
    [b.state.bottles, b.state.profiles, viewer],
  );
  useEffect(() => {
    if (b.mode !== "demo") return;
    let active = true;
    void AsyncStorage.getItem(demoKey)
      .then((raw) => {
        if (!active) return;
        const next = raw ? JSON.parse(raw) : seed();
        demoRef.current = next;
        setDemoPage(next);
      })
      .catch(() => {
        if (active) {
          demoRef.current = seed();
          setDemoPage(demoRef.current);
        }
      });
    return () => {
      active = false;
    };
  }, [b.mode]);
  const read = useCallback(
    async (
      owner?: string,
      following = false,
      before?: ShelfPost,
    ): Promise<SocialPage> => {
      if (b.mode === "live")
        return (await getLiveApi()).rpc(
          "social_read",
          {
            p_owner: owner || null,
            p_following: following,
            p_before: before?.created_at || null,
            p_before_id: before?.id || null,
          },
          viewer,
        );
      const data = demoRef.current || seed();
      return {
        ...data,
        posts: before
          ? []
          : data.posts.filter(
              (p) =>
                (data.page_enabled || p.owner_id !== viewer) &&
                (!owner || p.owner_id === owner) &&
                (!following || p.following),
            ),
        profile: owner
          ? data.posts.find((p) => p.owner_id === owner)?.collector || null
          : null,
      };
    },
    [b.mode, viewer, seed, demoPage],
  );
  const write = async (input: Write) => {
    if (b.mode === "live") {
      await (await getLiveApi()).rpc("social_write", input, viewer);
      return;
    }
    const data = JSON.parse(
      JSON.stringify(demoRef.current || seed()),
    ) as SocialPage;
    const own = b.state.profiles.find((p) => p.id === viewer)!;
    if (input.p_action === "report") return;
    if (input.p_action === "block")
      data.posts = data.posts.filter((p) => p.owner_id !== input.p_target);
    if (input.p_action === "page") data.page_enabled = !!input.p_enabled;
    if (
      !data.page_enabled &&
      !["page", "report", "block"].includes(input.p_action)
    )
      throw Error("Enable your public collector page first.");
    if (input.p_action === "post")
      data.posts.unshift({
        id: "demo-post-" + Date.now(),
        owner_id: viewer,
        caption: input.p_text || "",
        bottles: b.state.bottles
          .filter((x) => input.p_bottles?.includes(x.id))
          .map((x) => ({
            id: x.id,
            brand: x.brand,
            name: x.name,
            image_path: x.image_path!,
          })),
        created_at: new Date().toISOString(),
        collector: own,
        liked: false,
        following: false,
        likes: 0,
        comment_count: 0,
        comments: [],
      });
    if (input.p_action === "remove")
      data.posts = data.posts.filter((p) => p.id !== input.p_target);
    for (const p of data.posts) {
      if (input.p_action === "follow" && p.owner_id === input.p_target)
        p.following = !!input.p_enabled;
      if (p.id === input.p_target) {
        if (input.p_action === "like") {
          p.likes += Number(!!input.p_enabled) - Number(p.liked);
          p.liked = !!input.p_enabled;
        }
        if (input.p_action === "comment") {
          p.comments.push({
            id: "demo-comment-" + Date.now(),
            owner_id: viewer,
            handle: own.handle,
            body: input.p_text || "",
          });
          p.comment_count++;
        }
      }
      if (input.p_action === "remove-comment") {
        p.comments = p.comments.filter((c) => c.id !== input.p_target);
        p.comment_count = p.comments.length;
      }
    }
    demoRef.current = data;
    await AsyncStorage.setItem(demoKey, JSON.stringify(data));
    setDemoPage(data);
  };
  useFocusEffect(
    useCallback(() => {
      // Remount-free focus read; local view also reconciles on resume.
      if (b.mode === "demo" && demoRef.current)
        setDemoPage({ ...demoRef.current });
    }, [b.mode]),
  );
  return (
    <FeedView
      demo={b.mode === "demo"}
      viewer={viewer}
      read={read}
      write={write}
      ownBottles={b.state.bottles
        .filter(
          (x) =>
            x.owner_id === viewer && x.image_kind === "cutout" && x.image_path,
        )
        .map((x) => ({
          id: x.id,
          brand: x.brand,
          name: x.name,
          image_path: x.image_path!,
        }))}
    />
  );
}
export function PublicFeed({ onExit }: { onExit: () => void }) {
  const read = useCallback(
    async (owner?: string, following = false, before?: ShelfPost) =>
      (await getLiveApi()).rpc<SocialPage>("social_read", {
        p_owner: owner || null,
        p_following: following,
        p_before: before?.created_at || null,
        p_before_id: before?.id || null,
      }),
    [],
  );
  return <FeedView demo={false} viewer={null} read={read} onExit={onExit} />;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ivory },
  content: {
    paddingBottom: 120,
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 64,
  },
  logo: {
    fontFamily: fonts.bold,
    fontSize: 29,
    color: colors.green,
    letterSpacing: -1.2,
  },
  inline: { flexDirection: "row", alignItems: "center" },
  icon: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  switcher: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  filter: { minHeight: 48, justifyContent: "center", paddingHorizontal: 8 },
  filterText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  selected: { fontFamily: fonts.bold, color: colors.green },
  post: { paddingBottom: 22 },
  postHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontFamily: fonts.bold, color: colors.ivory, fontSize: 17 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  follow: { minHeight: 48, paddingHorizontal: 12, justifyContent: "center" },
  followText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  cabinet: {
    backgroundColor: "#0C291F",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 10,
  },
  shelfRow: {
    flexDirection: "row",
    height: 210,
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 10,
  },
  bottle: {
    height: 200,
    flex: 1,
    maxWidth: 180,
    justifyContent: "center",
    alignItems: "center",
  },
  cutout: { height: "100%", width: "100%" },
  contact: {
    position: "absolute",
    bottom: 0,
    width: "65%",
    height: 9,
    borderRadius: 30,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  photoError: { color: colors.ivory, fontSize: 13, textAlign: "center" },
  ledge: {
    height: 11,
    backgroundColor: "#34513D",
    borderTopWidth: 2,
    borderTopColor: "#A4AF83",
    marginBottom: 15,
  },
  postBottom: { paddingHorizontal: 16, gap: 6 },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
  },
  date: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  notice: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.muted,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  empty: { margin: 20, paddingVertical: 26, gap: 15 },
  error: { color: colors.error, fontSize: 16 },
  profile: { padding: 16, flexDirection: "row", gap: 8 },
  comment: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: colors.line,
    gap: 5,
  },
});
