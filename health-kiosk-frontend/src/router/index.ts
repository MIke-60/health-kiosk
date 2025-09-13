import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import Home from "../views/Home.vue";
import User from "../views/User.vue";
import Device from "../views/Device.vue";
import ExamData from "../views/ExamData.vue";
import SelfInfo from "../views/SelfInfo.vue";
import AdminIntruction from "../views/adminIntruction.vue";
import UseIntruction from "../views/useIntruction.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "Home",
    component: Home,
  },
  {
    path: "/user",//用户管理
    name: "User",
    component: User
  },
  {
    path: "/device",
    name: "Device",
    component: Device
  },
  {
    path: "/examdata",
    name: "ExamData",
    component: ExamData
  },
  {
    path: "/selfinfo",
    name: "SelfInfo",
    component: SelfInfo
  },
  {
    path: "/useintruction",
    name: "UseIntruction",
    component: UseIntruction
  },
  {
    path: "/adminintruction",
    name: "AdminIntruction",
    component: AdminIntruction
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
