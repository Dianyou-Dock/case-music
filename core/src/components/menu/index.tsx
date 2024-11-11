import React from "react";
import { useRouter } from "next/router";
import { Text, VStack, HStack, Image } from "@chakra-ui/react";

const Menu: React.FC = () => {
  const router = useRouter();
  const currentPath = router.pathname;
  console.log("currentPath: ", currentPath);

  const menuData = [
    {
      title: "所有音乐",
      path: "/all",
      icon: "/icons/music.svg",
    },
    {
      title: "专辑",
      path: "/record",
      icon: "/icons/record.svg",
    },
    {
      title: "艺术家",
      path: "/peoples",
      icon: "/icons/peoples.svg",
    },
    {
      title: "歌单",
      path: "/list",
      icon: "/icons/list.svg",
    },
  ];

  return (
    <>
      <VStack alignItems="flex-start" h="92vh" minW="120px">
        <Text fontSize="2xl">音乐库</Text>
        {menuData.map((item) => (
          <HStack
            key={item.title}
            pl="4"
            borderLeftWidth="4px"
            borderLeftColor={
              currentPath === item.path ? "green.500" : "blackAlpha.950"
            }
            cursor="pointer"
            onClick={() => router.push(item.path)}
          >
            <Image maxH="16px" src={item.icon} alt={item.title} />
            <Text>{item.title}</Text>
          </HStack>
        ))}
        <HStack cursor="pointer">
          <Image maxH="16px" src="/icons/setting.svg" />
          <Text>设置</Text>
        </HStack>
      </VStack>
    </>
  );
};

export default Menu;
